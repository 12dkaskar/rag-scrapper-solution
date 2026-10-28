import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";
import { AppError, redactErrorMessage } from "@rag-scrapper/core";
import { getRequestId } from "./request-id.js";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const requestId = getRequestId(ctx.getRequest());

    if (exception instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: exception.flatten(),
          requestId,
        },
      });
      return;
    }

    if (exception instanceof AppError) {
      res.status(exception.statusCode).json({
        error: {
          code: exception.code,
          message: exception.message,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body !== null && "message" in body
            ? String((body as { message: unknown }).message)
            : "Request failed";
      res.status(status).json({
        error: {
          code: status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
          message,
          requestId,
        },
      });
      return;
    }

    console.error({ err: redactErrorMessage(exception), requestId }, "Unhandled error");
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      },
    });
  }
}
