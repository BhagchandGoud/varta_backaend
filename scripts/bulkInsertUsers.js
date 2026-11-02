import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import UserModel from '../models/UserModel.js';

import dns from 'dns'

dns.setServers(['1.1.1.1' , '8.8.8.8']);
dotenv.config();

const parseArgs = () => {
  const result = {};

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, rawValue = 'true'] = arg.slice(2).split('=');
    result[rawKey] = rawValue;
  }

  return result;
};

const args = parseArgs();
const COUNT = Math.max(1, Number(args.count || 10000));
const BATCH_SIZE = Math.max(1, Number(args.batchSize || 500));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUser = (index, hash) => {
  const suffix = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `seeduser${suffix}@example.com`;
  const username = `user_${suffix}`.slice(0, 40);

  return {
    username,
    email,
    password: bcrypt.hashSync(`SeedPass@${index}!${hash}`, 10),
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isOnline: false,
    lastSeen: new Date(),
    profileImage: null,
    bio: `Seed user ${index}`,
    settings: {
      theme: 'system',
      messageNotifications: true,
      requestNotifications: true,
      mentionNotifications: true,
      reactionNotifications: true,
      soundNotifications: true,
      browserNotifications: false,
    },
  };
};

const ensureDbConnection = async () => {
  const dbUri = process.env.DB_CONNECTION;
  if (!dbUri) {
    throw new Error('DB_CONNECTION is not set. Add it to your .env file.');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 20,
    });
  }
};

const insertUsers = async () => {
  const start = Date.now();
  let inserted = 0;

  for (let i = 0; i < COUNT; i += BATCH_SIZE) {
    const batch = [];
    const batchEnd = Math.min(i + BATCH_SIZE, COUNT);

    for (let j = i; j < batchEnd; j++) {
      const hash = `${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
      batch.push(buildUser(j + 1, hash));
    }

    try {
      const result = await UserModel.insertMany(batch, { ordered: false });
      inserted += result.length;
      console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.length} users`);
    } catch (error) {
      if (error.code === 11000) {
        console.warn('Duplicate key hit; retrying batch with fallback inserts...');
        for (const doc of batch) {
          try {
            await UserModel.updateOne(
              { email: doc.email },
              { $setOnInsert: doc },
              { upsert: true }
            );
            inserted += 1;
          } catch (innerErr) {
            console.error('Failed single document insert:', innerErr.message);
          }
        }
      } else {
        throw error;
      }
    }

    await sleep(50);
  }

  const elapsedMs = Date.now() - start;
  console.log(`\nDone. Inserted ${inserted}/${COUNT} users in ${(elapsedMs / 1000).toFixed(2)}s.`);
};

const main = async () => {
  try {
    console.log(`Starting bulk insert for ${COUNT} users in batches of ${BATCH_SIZE}...`);
    await ensureDbConnection();
    await insertUsers();
  } catch (error) {
    console.error('Bulk insert failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main();
