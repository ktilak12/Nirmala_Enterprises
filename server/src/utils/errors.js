/**
 * Application errors carrying an HTTP status.
 *
 * Services throw these; the error middleware turns them into JSON responses.
 * Anything that is NOT an AppError is treated as an unexpected bug and is
 * logged in full but reported to the client as a generic 500, so internal
 * details never leak to a browser.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(message, 400, details);
export const unauthorized = (message = 'Authentication required.', details) =>
  new AppError(message, 401, details);
export const forbidden = (message = 'You do not have permission to do that.', details) =>
  new AppError(message, 403, details);
export const notFound = (message = 'Not found.', details) => new AppError(message, 404, details);
export const conflict = (message, details) => new AppError(message, 409, details);

/** Wrap an async route handler so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
