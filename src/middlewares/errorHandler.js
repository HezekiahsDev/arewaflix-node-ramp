import HttpError from "../utils/httpError.js";

const errorHandler = (err, req, res, next) => {
  const statusCode = err?.statusCode || 500;
  const message = err?.message || "Something went wrong on the server.";
  const isHttpError = err instanceof HttpError;

  const shouldLog = !isHttpError || statusCode >= 500;

  if (shouldLog) {
    const logPayload = isHttpError ? `[${statusCode}] ${message}` : err;
    console.error(logPayload);
    if (!isHttpError && err?.stack) {
      console.error(err.stack);
    }
  }

  // Only expose minimal error details to clients. In development, return more
  // information to aid debugging. Never send internal stack traces in
  // production.
  const isDev = process.env.NODE_ENV === "development";
  const clientError = {
    message,
  };

  if (isDev) {
    // In development include details and stack for easier debugging
    if (err?.details !== undefined) clientError.details = err.details;
    if (!isHttpError && err?.stack) clientError.stack = err.stack;
  }

  res.status(statusCode).json({ success: false, error: clientError });
};

export default errorHandler;
