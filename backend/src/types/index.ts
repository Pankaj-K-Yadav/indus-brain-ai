/**
 * Shared backend types. Domain types are added alongside their models later.
 */

/** Standard success envelope returned by API endpoints. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Standard error envelope returned by the error-handling middleware. */
export interface ApiError {
  success: false;
  error: {
    message: string;
    statusCode: number;
    details?: unknown;
  };
}
