const errorHandler = (err, req, res, next) => {
  console.error(err); // Log the error for debugging

  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong on the server.";

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      // Optional: include stack trace in development
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
};

export default errorHandler;
