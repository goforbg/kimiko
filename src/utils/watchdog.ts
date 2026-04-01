import { logger } from "./logger.js";

/**
 * Watchdog: tracks last activity timestamp.
 * If the bot goes unresponsive (no message processed) for too long,
 * it force-exits so PM2 can restart it.
 */

let lastActivity = Date.now();
const MAX_IDLE_MS = 10 * 60 * 1000; // 10 minutes with no activity is fine
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute
let lastMessageReceived = 0;

/** Call this every time a message is received to prove the bot is alive */
export function heartbeat(): void {
  lastActivity = Date.now();
  lastMessageReceived = Date.now();
}

/** Call this on startup to begin watchdog checks */
export function startWatchdog(): void {
  setInterval(() => {
    // Only check if we've received at least one message (bot is being used)
    if (lastMessageReceived === 0) return;

    const idleMs = Date.now() - lastActivity;
    if (idleMs > MAX_IDLE_MS) {
      logger.warn(
        { idleMs, lastActivity: new Date(lastActivity).toISOString() },
        "Watchdog: bot idle too long after receiving messages, restarting..."
      );
      process.exit(1); // PM2 will restart us
    }
  }, CHECK_INTERVAL_MS);

  logger.info("Watchdog started");
}
