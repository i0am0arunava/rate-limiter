---

# Rate Limiting API with Task Queue

This project is a Node.js API designed to handle user-based tasks with rate limiting and task queuing. The API enforces a rate limit of 1 task per second and 20 tasks per minute for each user ID. Tasks exceeding the rate limit are queued and processed accordingly. The API is connected to a Redis database hosted on Render.

## Project Structure

- **`index.js`**: The main file that sets up the server, rate limiting, task queue, and Redis connection.
- **`logs/app.log`**: A log file where all tasks and errors are recorded using Winston.
- **`.env`**: A file containing environment variables such as Redis connection URL and server port.

## Key Features

### 1. **Rate Limiting**
- The API implements two rate limiters using the `rate-limiter-flexible` library:
  - **Per-Second Rate Limiter**: Limits each user to 1 request per second.
  - **Per-Minute Rate Limiter**: Limits each user to 20 requests per minute.

### 2. **Task Queueing**
- The API uses `bullmq` to manage tasks that exceed the rate limit. These tasks are added to a Redis-backed queue and processed asynchronously.

### 3. **Logging**
- All task completions and errors are logged using the `winston` logging library. Logs are stored in `logs/app.log` and are also output to the console.

## Setup and Configuration

### 1. **Environment Variables**
- Create a `.env` file in the root directory and add the following environment variables:
  ```
  REDIS_DB_URL=rediss://<username>:<password>@<hostname>:6379
  PORT=3000
  ```

### 2. **Redis Connection**
- The application connects to a Redis database using the `ioredis` library. The Redis database is hosted on Render and is secured with TLS.

### 3. **Rate Limiting Middleware**
- The `rateLimiterMiddleware` checks the rate limits for each request. If a user exceeds the rate limit, the request is added to the task queue and a `202 Accepted` response is sent to the client with a "Retry-After" header.

### 4. **Task Queue and Worker**
- The `Queue` is set up using `bullmq`, and tasks are processed by a `Worker`. The worker function executes the `task` function, which logs task completion to the `app.log` file.

## How to Run the Project

### 1. **Install Dependencies**
- Run `npm install` to install all required dependencies.

### 2. **Run the Server**
- Start the server using `npm start`. The server will run on the port specified in the `.env` file or default to port 3000.

### 3. **Testing the API**
- You can test the API by sending POST requests to `https://rate-limiter-x2xw.onrender.com/api/v1/task` with a JSON body containing a `user_id`. For example:
  ```json
  {
    "user_id": "123"
  }
  ```
- The API will process the task immediately if within the rate limit, or queue it if the rate limit is exceeded.

## API Endpoints

### POST `/api/v1/task`
- **Request Body**: JSON
  ```json
  {
    "user_id": "123"
  }
  ```
- **Response**: 
  - `200 OK` if the task is processed immediately.
  - `202 Accepted` if the task is queued due to rate limiting.
  - `429 Too Many Requests` if the rate limit is exceeded and cannot be queued.
  
## Notes
- Ensure that Redis is running with a `noeviction` policy to avoid unexpected behavior.
- The Redis instance should be properly configured with the correct authentication and TLS settings.

## Conclusion

This API ensures that tasks are processed efficiently while respecting user-specific rate limits. The use of Redis and `bullmq` enables reliable and scalable task management, making the system resilient to high traffic and rate limit violations.

---
