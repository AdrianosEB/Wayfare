import type { ErrorCode, ApiError } from "@wayfare/shared";

/**
 * Typed application error mapping to the uniform error shape + HTTP status in API_CONTRACT.md.
 */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_request: 400,
  session_not_found: 404,
  not_ready: 409,
  unplannable: 422,
  rate_limited: 429,
  internal: 500,
  // auth (see @wayfare/shared/auth + AUTH_CONTRACT.md)
  email_taken: 409,
  invalid_credentials: 401,
  unauthenticated: 401,
};

export const emailTaken = (message = "That email is already registered.") =>
  new AppError("email_taken", message);
export const invalidCredentials = (message = "Invalid email or password.") =>
  new AppError("invalid_credentials", message);
export const unauthenticated = (message = "Sign in required.") =>
  new AppError("unauthenticated", message);

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const notFound = (message = "Unknown session.") =>
  new AppError("session_not_found", message);
export const invalid = (message: string, details?: unknown) =>
  new AppError("invalid_request", message, details);
export const notReady = (message: string) =>
  new AppError("not_ready", message);
export const unplannable = (message: string, details?: unknown) =>
  new AppError("unplannable", message, details);
