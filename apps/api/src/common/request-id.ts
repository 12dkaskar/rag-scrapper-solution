import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length > 0 && incoming.length < 128 ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  (req as Request & { requestId: string }).requestId = id;
  next();
}

export function getRequestId(req: { requestId?: string }): string {
  return req.requestId ?? "unknown";
}
