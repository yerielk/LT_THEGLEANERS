export type ErrorCode =
  | "WORK_NOT_FOUND"
  | "EXHIBITION_NOT_FOUND"
  | "KEY_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RECOMMENDATION_EMPTY"
  | "SERVICE_UNAVAILABLE";

const STATUS: Record<ErrorCode, number> = {
  WORK_NOT_FOUND: 404,
  EXHIBITION_NOT_FOUND: 404,
  KEY_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RECOMMENDATION_EMPTY: 404,
  SERVICE_UNAVAILABLE: 503,
};

export class LectaError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable = code === "SERVICE_UNAVAILABLE",
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
  toJSON() {
    return { error: { code: this.code, message: this.message, retryable: this.retryable, ...(this.details ? { details: this.details } : {}) } };
  }
}

export function asLectaError(e: unknown): LectaError {
  if (e instanceof LectaError) return e;
  return new LectaError("SERVICE_UNAVAILABLE", "Unexpected server error", true);
}
