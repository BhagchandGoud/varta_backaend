import { createClient } from "redis";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
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
