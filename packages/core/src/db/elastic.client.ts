import { Client } from "@elastic/elasticsearch";
import type { Env } from "../config/env.js";

let client: Client | null = null;

export async function connectElasticsearch(env: Env): Promise<Client> {
  if (client) return client;
  client = new Client({
    node: env.ELASTICSEARCH_URL,
    auth: { apiKey: env.ELASTICSEARCH_API_KEY },
  });
  await client.ping();
  return client;
}

export function getElasticsearchClient(): Client {
  if (!client) {
    throw new Error("Elasticsearch is not connected");
  }
  return client;
}

export async function closeElasticsearch(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}

export async function pingElasticsearch(): Promise<boolean> {
  try {
    if (!client) return false;
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
