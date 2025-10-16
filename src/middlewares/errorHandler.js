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

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      details: err?.details,
      stack:
        process.env.NODE_ENV === "development" && !isHttpError
          ? err?.stack
          : undefined,
    },
  });
};

export default errorHandler;
