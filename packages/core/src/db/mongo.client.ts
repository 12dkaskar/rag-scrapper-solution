import { MongoClient, Db } from "mongodb";
import type { Env } from "../config/env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(env: Env): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  db = client.db(env.MONGODB_DATABASE);
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB is not connected");
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function pingMongo(): Promise<boolean> {
  try {
    const database = getDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
