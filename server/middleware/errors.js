/** Error plumbing: a typed ApiError plus a single Express error handler. */

export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, 'BAD_REQUEST', details); }
  static unauthorized(msg) { return new ApiError(401, msg, 'AUTH_REQUIRED'); }
  static forbidden(msg) { return new ApiError(403, msg, 'FORBIDDEN'); }
  static notFound(msg, details) { return new ApiError(404, msg, 'NOT_FOUND', details); }
  static conflict(msg, details) { return new ApiError(409, msg, 'CONFLICT', details); }
  static unprocessable(msg, details) { return new ApiError(422, msg, 'VALIDATION', details); }
}

/** Wraps async route handlers so rejected promises reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  // Log server-side detail, but never leak internals (or secrets) to the client.
  if (status >= 500) console.error('[api-error]', req.method, req.originalUrl, err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    code: err.code || 'ERROR',
    details: status < 500 ? err.details ?? null : undefined,
  });
}
