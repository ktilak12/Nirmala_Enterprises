import { badRequest } from '../utils/errors.js';

/**
 * Zod validation middleware (Section 45's "input validation").
 *
 * Validation happens at the edge so services can trust their inputs, and the
 * error shape is uniform: `{ error, details: { field: [messages] } }`, which the
 * client renders directly under the offending form field.
 *
 * Parsed output lands on `req.valid.{body,query,params}`, never back on
 * `req.query`. Express 5 defines `query` as a getter-only property, so assigning
 * to it throws "Cannot set property query of #<IncomingMessage> which has only a
 * getter" - which would have turned every list endpoint into a 500. Keeping the
 * three sources separate also means a body field can never quietly overwrite a
 * URL parameter of the same name.
 */
function formatIssues(issues) {
  const details = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_';
    details[key] ??= [];
    details[key].push(issue.message);
  }
  return details;
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        badRequest('Please correct the highlighted fields.', formatIssues(result.error.issues)),
      );
    }
    req.valid ??= { body: {}, query: {}, params: {} };
    req.valid[source] = result.data;
    return next();
  };
}

export const validateQuery = (schema) => validate(schema, 'query');
export const validateParams = (schema) => validate(schema, 'params');
