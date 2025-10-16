export default class HttpError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = "HttpError";
    this.statusCode = Number.isInteger(statusCode) ? statusCode : 500;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, HttpError);
  }
}
