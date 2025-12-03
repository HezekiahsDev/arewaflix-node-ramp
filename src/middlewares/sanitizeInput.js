// Middleware: sanitize input body strings by trimming and removing control characters
function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === "string") {
      // Trim and remove ASCII control chars except newline/tab
      obj[key] = v.trim().replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
    }
  }
}

export default function sanitizeInput(req, _res, next) {
  // Sanitize body, query, and params strings to reduce injection/XSS surface
  sanitizeObjectStrings(req.body);
  sanitizeObjectStrings(req.query);
  sanitizeObjectStrings(req.params);
  next();
}
