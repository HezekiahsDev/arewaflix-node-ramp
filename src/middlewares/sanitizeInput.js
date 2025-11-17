// Middleware: sanitize input body strings by trimming and removing control characters
export default function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      const v = req.body[key];
      if (typeof v === "string") {
        // Trim and remove ASCII control chars except newline/tab
        req.body[key] = v
          .trim()
          .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
      }
    }
  }
  next();
}
