import express from "express";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import winston, { format, transports } from "winston";

const app = express();
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

// Connect to Redis (adjust port if needed)
const redisClient = new Redis({
  host: "127.0.0.1", // Localhost, adjust if needed
  port: 6379, // Default Redis port, adjust if Docker is mapping differently
  enableOfflineQueue: false,
});

redisClient.on("error", (err) => {
  logger.error(`Redis connection error: ${err}`); // Use winston for logging errors
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

// Rate limiting middleware
const rateLimiterMiddleware = async (req, res, next) => {
  const { user_id } = req.body;

  try {
    // Consume a point from the rate limiter per second
    await rpsLimiter.consume(user_id);

    // Consume a point from the rate limiter per minute
    await rpmLimiter.consume(user_id);

    // If both limiters succeed, proceed to the next middleware or route handler
    next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      // Log Redis or rate limiter error
      logger.error(`Rate limiter Redis error: ${rejRes}`);
      res.status(500).json({ msg: "Internal Server Error" });
    } else {
      // Handle rate limit exceeded scenario
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;

      // Determine which limiter was exceeded and set the Retry-After header
      if (rejRes.consumedPoints <= 1) {
        res.set("Retry-After", String(secs));
        logger.warn(
          `Per-second rate limit exceeded for user ${user_id}. Retry after ${secs} seconds.`
        );
      } else {
        res.set("Retry-After", String(secs));
        logger.warn(
          `Per-minute rate limit exceeded for user ${user_id}. Retry after ${secs} seconds.`
        );
      }

      res.status(429).json({ msg: "Too Many Requests" });
    }
  }
};

// Express route
app.post("/api/v1/task", rateLimiterMiddleware, (req, res) => {
  const { user_id } = req.body;

  async function task(user_id) {
    // Log task completion with a readable timestamp
    logger.info(
      `Task completed for user ${user_id} at ${new Date().toLocaleString()}`
    );
  }

  task(user_id);
  res.send("Hello World");
});

// Start server
app.listen(3000, () => {
  logger.info("Server is running on port 3000");
});
