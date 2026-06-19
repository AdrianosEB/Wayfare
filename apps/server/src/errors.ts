import type { ErrorCode, ApiError, AuthErrorCode } from "@wayfare/shared";

/**
 * Typed application error mapping to the uniform error shape + HTTP status in API_CONTRACT.md.
 */
const STATUS_BY_CODE: Record<ErrorCode | AuthErrorCode, number> = {
  invalid_request: 400,
  session_not_found: 404,
  not_ready: 409,
  unplannable: 422,
  rate_limited: 429,
  internal: 500,
  // auth (docs/AUTH_CONTRACT.md)
  email_taken: 409,
  invalid_credentials: 401,
  unauthenticated: 401,
};

export class AppError extends Error {
  readonly code: ErrorCode | AuthErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode | AuthErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ApiError {
    return {
      error: {
        // code is ErrorCode | AuthErrorCode; the wire shape carries it verbatim.
        code: this.code as ApiError["error"]["code"],
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

/* auth (docs/AUTH_CONTRACT.md) */
export const emailTaken = (message = "That email is already registered.") =>
  new AppError("email_taken", message);
/** Identical for unknown-email and wrong-password — no account enumeration. */
export const invalidCredentials = (message = "Incorrect email or password.") =>
  new AppError("invalid_credentials", message);
export const unauthenticated = (message = "Authentication required.") =>
  new AppError("unauthenticated", message);
