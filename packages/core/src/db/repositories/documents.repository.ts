import { Collection, Filter } from "mongodb";
import type { Env } from "../../config/env.js";
import { getDb } from "../mongo.client.js";
import type { DocumentStatus, RagDocumentRecord, SourceType } from "../../types/domain.js";
import { NotFoundError } from "../../utils/errors.js";

export interface CreateDocumentInput {
  documentId: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string;
  contentHash: string | null;
}

export class DocumentsRepository {
  private collection: Collection<RagDocumentRecord>;

  constructor(env: Env) {
    this.collection = getDb().collection<RagDocumentRecord>(
      env.MONGODB_DOCUMENTS_COLLECTION,
    );
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ documentId: 1 }, { unique: true });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ contentHash: 1 }, { sparse: true });
  }

  async findByContentHash(hash: string): Promise<RagDocumentRecord | null> {
    return this.collection.findOne({ contentHash: hash });
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
    await this.collection.insertOne(doc);
    return doc;
  }

  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    fields: Partial<Pick<RagDocumentRecord, "chunkCount" | "errorSummary" | "title">> = {},
  ): Promise<RagDocumentRecord> {
    const result = await this.collection.findOneAndUpdate(
      { documentId },
      {
        $set: { status, updatedAt: new Date(), ...fields },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      throw new NotFoundError(`Document not found: ${documentId}`);
    }
    return result;
  }

  async getByDocumentId(documentId: string): Promise<RagDocumentRecord> {
    const doc = await this.collection.findOne({ documentId });
    if (!doc) {
      throw new NotFoundError(`Document not found: ${documentId}`);
    }
    return doc;
  }

  async list(page: number, limit: number): Promise<{ items: RagDocumentRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const filter: Filter<RagDocumentRecord> = {};
    const [items, total] = await Promise.all([
      this.collection
        .find(filter, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items, total };
  }

  async delete(documentId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ documentId });
    return result.deletedCount > 0;
  }
}
