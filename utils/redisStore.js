import { redisClient } from "../redis.js";
import { logger } from "./logger.js";

const isAvailable = () => Boolean(redisClient.isReady);

const reportRedisFailure = (operation, error) => {
  logger.warn("redis_cache_operation_failed", {
    operation,
    message: error.message,
  });
};

export const getRedisValue = async (key) => {
  if (!isAvailable()) return null;
  try {
    return await redisClient.get(key);
  } catch (error) {
    reportRedisFailure("get", error);
    return null;
  }
};

export const setRedisValue = async (key, value, ttlSeconds) => {
  if (!isAvailable()) return false;
  try {
    await redisClient.set(key, value, { EX: ttlSeconds });
    return true;
  } catch (error) {
    reportRedisFailure("set", error);
    return false;
  }
};

export const deleteRedisValue = async (key) => {
  if (!isAvailable()) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    reportRedisFailure("delete", error);
    return false;
  }
};

export const getRedisJson = async (key) => {
  const value = await getRedisValue(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    reportRedisFailure("parse-json", error);
    await deleteRedisValue(key);
    return null;
  }
};

export const setRedisJson = (key, value, ttlSeconds) =>
  setRedisValue(key, JSON.stringify(value), ttlSeconds);
