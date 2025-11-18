// Utility to produce a safe public representation of a user record
export function sanitizeUserForClient(user) {
  if (!user || typeof user !== "object") return {};
  const allowed = [
    "id",
    "username",
    "email",
    "display_name",
    "first_name",
    "last_name",
    "language",
    "created_at",
    "updated_at",
    "is_active",
  ];
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(user, k)) {
      out[k] = user[k];
    }
  }
  if (!out.id && user.id) out.id = user.id;
  if (!out.username && user.username) out.username = user.username;
  return out;
}

export function sanitizeUsersList(users) {
  if (!Array.isArray(users)) return [];
  return users.map((u) => sanitizeUserForClient(u));
}
