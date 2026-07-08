/**
 * Application-level HTTP error carrying a status code. Thrown by any layer and
 * translated to a response by the centralized error-handling middleware.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message = 'Bad Request', details?: unknown): HttpError {
    return new HttpError(400, message, details);
  }

  static notFound(message = 'Not Found', details?: unknown): HttpError {
    return new HttpError(404, message, details);
  }
}
