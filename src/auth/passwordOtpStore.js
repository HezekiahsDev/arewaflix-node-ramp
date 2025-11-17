import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "password_reset_otps.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(FILE_PATH);
  } catch (err) {
    // File doesn't exist -> create an empty array
    await fs.writeFile(FILE_PATH, JSON.stringify([]), "utf8");
  }
}

async function readAll() {
  await ensureDataFile();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    // Corrupt file — reset to empty
    await fs.writeFile(FILE_PATH, JSON.stringify([]), "utf8");
    return [];
  }
}

async function writeAll(arr) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(arr, null, 2), "utf8");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default {
  // create a new OTP entry and return it
  async createOtp({ userId, email, otp, expiresAt }) {
    const all = await readAll();
    const entry = {
      id: makeId(),
      user_id: userId,
      email,
      otp: String(otp),
      expires_at: Number(expiresAt),
      attempts: 0,
      created_at: Date.now(),
    };
    all.push(entry);
    await writeAll(all);
    return entry;
  },

  // get the most recent unconsumed entry for an email (we delete consumed ones)
  async getLatest(email) {
    const all = await readAll();
    const matches = all.filter((e) => e.email === email);
    if (matches.length === 0) return null;
    // return most recent by created_at
    matches.sort((a, b) => b.created_at - a.created_at);
    return matches[0];
  },

  // increment attempts; return the new attempts count (or null if not found)
  async incrementAttempts(id) {
    const all = await readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx].attempts = (all[idx].attempts || 0) + 1;
    await writeAll(all);
    return all[idx].attempts;
  },

  // delete an entry by id (used when consumed or expired)
  async deleteById(id) {
    const all = await readAll();
    const filtered = all.filter((e) => e.id !== id);
    if (filtered.length === all.length) return false;
    await writeAll(filtered);
    return true;
  },

  // for tests/debugging: clear all entries
  async clearAll() {
    await writeAll([]);
  },
};
