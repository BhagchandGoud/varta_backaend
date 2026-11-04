import { createClient } from "redis";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    keepAlive: 5000,
    reconnectStrategy: (retries) => Math.min(1000 * 2 ** retries, 30000),
  },
});

redisClient.on("error", (err) => {
  logger.error("redis_client_error", err);
});

export async function connectRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  await redisClient.ping();
  logger.info("redis_connected");
}
