import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/** 404 for any unmatched API route. */
export function notFoundHandler(req, _res, next) {
  next(new AppError(`No API route matches ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Single error responder.
 *
 * Two jobs. First, translate the database's own failures into something a clerk
 * can act on - a duplicate-key error becomes "A product with that code already
 * exists", not "E11000". Second, make sure an unexpected bug is logged in full
 * server-side but reported as a bare 500, so stack traces and connection
 * strings never reach a browser (Section 45).
 */
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode ?? 500;
  let message = err.message ?? 'Something went wrong.';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Please correct the highlighted fields.';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, [e.message]]),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `"${err.value}" is not a valid ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'value';
    message = `That ${field} is already in use.`;
    details = { [field]: ['Already in use.'] };
  } else if (
    // A write conflict is two clerks touching the same document at the same
    // instant. It is safe and expected under load, and retrying is correct.
    err.errorLabels?.includes('TransientTransactionError') ||
    err.codeName === 'WriteConflict'
  ) {
    status = 409;
    message = 'Someone else saved a change at the same moment. Please try again.';
  }

  const unexpected = !(err instanceof AppError) && status >= 500;

  if (unexpected) {
    console.error('[error]', req.method, req.originalUrl, '\n', err);
    if (!env.isDevelopment) {
      message = 'Something went wrong. The problem has been logged.';
      details = undefined;
    }
  }

  res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
    ...(env.isDevelopment && unexpected ? { stack: err.stack } : {}),
  });
}
