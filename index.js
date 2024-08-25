import dotenv from "dotenv";
import express from "express";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import winston, { format, transports } from "winston";
import { Queue, Worker } from "bullmq";

const app = express();
dotenv.config({
  path: "./.env",
});

app.use(express.json({ limit: "16kb" }));

// Set up winston logger
const logger = winston.createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(
      ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
    )
  ),
  transports: [
    new transports.File({ filename: "logs/app.log", level: "info" }), // Log all messages to this file
    new transports.Console(), // Also log to the console
  ],
});

// Connect to Redis
const redisClient = new Redis(process.env.REDIS_DB_URL, {
  tls: true, // Enabled TLS/SSL for secure connection
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
});

redisClient.on("error", (err) => {
  logger.error(`Redis connection error: ${err}`);
});

// Rate limit per second
const rpsLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 1,
  duration: 1,
  blockDuration: 0,
  keyPrefix: "rps",
});

// Rate limit per minute
const rpmLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 20,
  duration: 60,
  blockDuration: 0,
  keyPrefix: "rpm",
});

// Task Queue
const taskQueue = new Queue("task-queue", {
  connection: redisClient,
});

// Task Worker
new Worker(
  "task-queue",
  async (job) => {
    const { user_id } = job.data;
    await task(user_id);
  },
  {
    connection: redisClient,
  }
);

// Rate limiting middleware with queueing
const rateLimiterMiddleware = async (req, res, next) => {
  const { user_id } = req.body;

  try {
    await rpsLimiter.consume(user_id);
    await rpmLimiter.consume(user_id);
    next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      logger.error(`Rate limiter Redis error: ${rejRes}`);
      res.status(500).json({ msg: "Internal Server Error" });
    } else {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      logger.warn(
        `Rate limit exceeded for user ${user_id}. Queuing task. Retry after ${secs} seconds.`
      );

      // Add the task to the queue
      await taskQueue.add("process-task", { user_id });
      res.set("Retry-After", String(secs));
      res.status(202).json({ msg: "Task queued due to rate limit." });
    }
  }
};

// Task function
async function task(user_id) {
  logger.info(
    `Task completed for user ${user_id} at ${new Date().toLocaleString()}`
  );
}

// Express route
app.post("/api/v1/task", rateLimiterMiddleware, (req, res) => {
  const { user_id } = req.body;

  // Process the task immediately if within rate limit
  taskQueue.add("process-task", { user_id });
  res.send("Task is being processed");
});

// Start server
app.listen(process.env.PORT || 3000, () => {
  logger.info(`Server is running on port 3000 || ${process.env.PORT}`);
});
