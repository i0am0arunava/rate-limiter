---

# API Testing Guide

This document provides a step-by-step guide to testing the rate-limiting API with task queuing. The API is hosted at `https://rate-limiter-x2xw.onrender.com/api/v1/task`.

## Testing Overview

The API enforces rate limits on requests made by individual users. This guide will walk you through sending requests to the API and observing the responses based on rate limits.

## API Endpoint

- **URL**: `https://rate-limiter-x2xw.onrender.com/api/v1/task`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body**: JSON

## Test Scenarios

### 1. **Single Request Within Rate Limit**

**Description**: Send a single request for a user that does not exceed the rate limit.

**Steps**:
1. Send a `POST` request to the API with the following JSON body:
   ```json
   {
     "user_id": "123"
   }
   ```
2. The API should process the task immediately and return a `200 OK` response with the message `Task is being processed`.

### 2. **Multiple Requests Within Per-Second Limit**

**Description**: Send multiple requests (up to 1 per second) for the same user within the per-second rate limit.

**Steps**:
1. Send up to 1 `POST` request per second with the following JSON body:
   ```json
   {
     "user_id": "123"
   }
   ```
2. The API should process each task immediately, returning `200 OK` for each request.

### 3. **Exceeding Per-Second Rate Limit**

**Description**: Send more than 1 request per second for the same user to trigger the rate limit.

**Steps**:
1. Send 2 or more `POST` requests in rapid succession (within the same second) with the following JSON body:
   ```json
   {
     "user_id": "123"
   }
   ```
2. The first request should return `200 OK`, while the subsequent request(s) should return a `202 Accepted` response indicating that the task has been queued due to rate limiting.

**Expected Response**:
   ```json
   {
     "msg": "Task queued due to rate limit."
   }
   ```

### 4. **Exceeding Per-Minute Rate Limit**

**Description**: Send more than 20 requests within a minute for the same user to trigger the per-minute rate limit.

**Steps**:
1. Send more than 20 `POST` requests within a 60-second window with the following JSON body:
   ```json
   {
     "user_id": "123"
   }
   ```
2. After the first 20 requests, subsequent requests should trigger the rate limiter and queue the tasks, returning a `202 Accepted` response with the `Retry-After` header indicating when to retry.

**Expected Response**:
   ```json
   {
     "msg": "Task queued due to rate limit."
   }
   ```

### 5. **Observing Queue Behavior**

**Description**: After triggering the rate limit and queuing tasks, observe the task queue processing.

**Steps**:
1. Continuously send requests until tasks are queued.
2. Monitor the logs (`logs/app.log`) or the API responses to see when queued tasks are processed after the rate limit window resets.

## Conclusion

By following these test scenarios, you can thoroughly validate the rate limiting and task queuing behavior of the API. This ensures that the API handles user requests efficiently and adheres to the specified rate limits.

---
