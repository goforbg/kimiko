import { config } from "../config.js";

interface UserRecord {
  timestamps: number[];
}

const users = new Map<string, UserRecord>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const limit = config.rateLimitPerUser;

  let record = users.get(userId);
  if (!record) {
    record = { timestamps: [] };
    users.set(userId, record);
  }

  // Prune old timestamps outside the window
  record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);

  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}
