import type { Env } from "../../config/env.js";
import type {
  DocumentStatus,
  RagDocumentRecord,
  SourceType,
} from "../../types/domain.js";
import { NotFoundError } from "../../utils/errors.js";
import { getElasticsearchClient } from "../elastic.client.js";
import { ensureElasticIndices } from "../elastic-indices.js";

export interface CreateDocumentInput {
  documentId: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  contentHash: string | null;
}

type StoredDocument = Omit<RagDocumentRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function toStored(doc: RagDocumentRecord): StoredDocument {
  return {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function fromStored(stored: StoredDocument): RagDocumentRecord {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

export class DocumentsRepository {
  private index: string;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.index = env.ELASTICSEARCH_DOCUMENTS_INDEX;
  }

  async ensureIndexes(): Promise<void> {
    await ensureElasticIndices(this.env);
  }

  async findByContentHash(hash: string): Promise<RagDocumentRecord | null> {
    const client = getElasticsearchClient();
    const result = await client.search<StoredDocument>({
      index: this.index,
      size: 1,
      query: { term: { contentHash: hash } },
    });
    const hit = result.hits.hits[0]?._source;
    return hit ? fromStored(hit) : null;
  }

  async create(input: CreateDocumentInput): Promise<RagDocumentRecord> {
    const now = new Date();
    const doc: RagDocumentRecord = {
      ...input,
      status: "pending",
      chunkCount: 0,
      errorSummary: null,
      createdAt: now,
      updatedAt: now,
    };
    const client = getElasticsearchClient();
    await client.index({
      index: this.index,
      id: input.documentId,
      document: toStored(doc),
      refresh: "wait_for",
    });
    return doc;
  }

  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    fields: Partial<Pick<RagDocumentRecord, "chunkCount" | "errorSummary" | "title">> = {},
  ): Promise<RagDocumentRecord> {
    const client = getElasticsearchClient();
    try {
      await client.update({
        index: this.index,
        id: documentId,
        doc: {
          status,
          updatedAt: new Date().toISOString(),
          ...fields,
        },
      });
      return this.getByDocumentId(documentId);
    } catch (err: unknown) {
      const statusCode = (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
      if (statusCode === 404) {
        throw new NotFoundError(`Document not found: ${documentId}`);
      }
      throw err;
    }
  }

  async getByDocumentId(documentId: string): Promise<RagDocumentRecord> {
    const client = getElasticsearchClient();
    try {
      const result = await client.get<StoredDocument>({ index: this.index, id: documentId });
      if (!result._source) {
        throw new NotFoundError(`Document not found: ${documentId}`);
      }
      return fromStored(result._source);
    } catch (err: unknown) {
      const statusCode = (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
      if (statusCode === 404) {
        throw new NotFoundError(`Document not found: ${documentId}`);
      }
      throw err;
    }
  }

  async list(page: number, limit: number): Promise<{ items: RagDocumentRecord[]; total: number }> {
    const client = getElasticsearchClient();
    const from = (page - 1) * limit;
    const result = await client.search<StoredDocument>({
      index: this.index,
      from,
      size: limit,
      track_total_hits: true,
      sort: [{ createdAt: { order: "desc" } }],
      query: { match_all: {} },
    });
    const total =
      typeof result.hits.total === "number"
        ? result.hits.total
        : (result.hits.total?.value ?? 0);
    const items = result.hits.hits
      .map((h) => h._source)
      .filter((s): s is StoredDocument => s != null)
      .map(fromStored);
    return { items, total };
  }

  async delete(documentId: string): Promise<boolean> {
    const client = getElasticsearchClient();
    try {
      const result = await client.delete({ index: this.index, id: documentId });
      return result.result === "deleted";
    } catch (err: unknown) {
      const statusCode = (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
      if (statusCode === 404) return false;
      throw err;
    }
  }
}
