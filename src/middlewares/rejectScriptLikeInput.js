// Middleware: reject requests containing script-like payloads in strings
// Scans `req.body`, `req.query`, and `req.params` recursively for patterns
// commonly used in XSS or script injection vectors and returns 400.
function isScriptLikeString(s) {
  if (!s || typeof s !== "string") return false;
  const pattern =
    /<\s*script\b|<\s*\/\s*script\b|javascript:|on\w+\s*=|<\s*(iframe|img|svg|object|embed|link|meta)\b|<\?|%>|<%|\b(alert|prompt|confirm)\s*\(|\beval\s*\(|\bdocument\.|\bwindow\.|\bsetTimeout\s*\(|\bsetInterval\s*\(|\bnew\s+Function\s*\(/i;
  return pattern.test(s);
}

function scanValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return isScriptLikeString(v);
  if (Array.isArray(v)) {
    for (const it of v) if (scanValue(it)) return true;
    return false;
  }
  if (typeof v === "object") {
    for (const k of Object.keys(v)) if (scanValue(v[k])) return true;
    return false;
  }
  return false;
}

export default function rejectScriptLikeInput(req, res, next) {
  try {
    if (scanValue(req.body) || scanValue(req.query) || scanValue(req.params)) {
      return res.status(400).json({
        success: false,
        message: "Request contains disallowed script-like content.",
      });
    }
    return next();
  } catch (err) {
    // Fail open to avoid blocking legitimate traffic if scanner errors
    return next();
  }
}
