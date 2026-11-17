/**
 * An error the API answers with on purpose. The error handler in app.js turns it into
 * ApiErrorBody: { error: { code, message, fields? } } with this status.
 * The message is shown to shoppers, so keep it plain and free of internals.
 */
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (fields && Object.keys(fields).length > 0) this.fields = fields;
  }
}

// Each helper returns the error so the call site reads `throw notFound('Product')`.

/** 400 validation_error. `fields` maps a dotted field path to its message. */
export function badRequest(message = 'Check the details and try again.', fields) {
  return new HttpError(400, 'validation_error', message, fields);
}

/** 401 unauthorized: nobody is signed in. */
export function unauthorized(message = 'Sign in to continue.') {
  return new HttpError(401, 'unauthorized', message);
}

/** 403 forbidden: signed in, but not allowed. */
export function forbidden(message = 'You do not have access to this.') {
  return new HttpError(403, 'forbidden', message);
}

/** 404 not_found. `what` names the missing thing: notFound('Order') gives "Order not found." */
export function notFound(what = 'Page') {
  return new HttpError(404, 'not_found', `${what} not found.`);
}

/** 409 with code 'conflict', or another code such as 'out_of_stock'. */
export function conflict(message = 'That clashes with something that already exists.', code = 'conflict') {
  return new HttpError(409, code, message);
}

/** The JSON body for an error response. */
export function errorBody(code, message, fields) {
  const error = { code, message };
  if (fields && Object.keys(fields).length > 0) error.fields = fields;
  return { error };
}
