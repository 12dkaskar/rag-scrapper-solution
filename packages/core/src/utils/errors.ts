export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message, 400, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ProviderError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode, "PROVIDER_ERROR");
  }
}

export function redactErrorMessage(err: unknown): string {
  if (err instanceof AppError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message.replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED]");
  }
  return "An unexpected error occurred";
}
