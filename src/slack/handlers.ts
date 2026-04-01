import type { App, AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { askKimiko } from "../ai/client.js";
import { buildSlackContext } from "../ai/context-builder.js";
import { toSlackMarkdown, splitForSlack } from "./formatters.js";
import { checkRateLimit } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";
import { heartbeat } from "../utils/watchdog.js";

// Cache of user ID -> display name
const userNameCache = new Map<string, string>();

async function resolveUserName(
  app: App,
  userId: string
): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;

  try {
    const result = await app.client.users.info({ user: userId });
    const name =
      result.user?.real_name || result.user?.name || userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

type MentionArgs = AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">;
type MessageArgs = AllMiddlewareArgs & SlackEventMiddlewareArgs<"message">;

export function registerSlackHandlers(app: App): void {
  // Handle @mentions
  app.event("app_mention", async (args: MentionArgs) => {
    const { event, say } = args;

    const userId = event.user || "unknown";
    const { allowed } = checkRateLimit(`slack:${userId}`);
    if (!allowed) {
      await say({
        text: "You're sending too many requests. Chill for a bit and try again.",
        thread_ts: event.thread_ts || event.ts,
      });
      return;
    }

    heartbeat();

    try {
      // Show typing indicator by posting a temporary message
      const channel = event.channel;
      const threadTs = event.thread_ts || event.ts;

      // Fetch thread history if in a thread
      let threadMessages: Array<{
        user?: string;
        text?: string;
        bot_id?: string;
      }> = [];

      if (event.thread_ts) {
        try {
          const history = await app.client.conversations.replies({
            channel,
            ts: event.thread_ts,
            limit: 50,
          });
          threadMessages = (history.messages || []) as Array<{
            user?: string;
            text?: string;
            bot_id?: string;
          }>;
        } catch (err) {
          logger.warn({ err }, "Failed to fetch thread history");
        }
      } else {
        // Fetch recent channel messages for context
        try {
          const history = await app.client.conversations.history({
            channel,
            limit: 10,
          });
          threadMessages = (history.messages || []).reverse() as Array<{
            user?: string;
            text?: string;
            bot_id?: string;
          }>;
        } catch (err) {
          logger.warn({ err }, "Failed to fetch channel history");
        }
      }

      // Resolve user names
      const uniqueUsers = new Set(
        threadMessages.map((m) => m.user).filter(Boolean) as string[]
      );
      for (const uid of uniqueUsers) {
        await resolveUserName(app, uid);
      }

      const context = buildSlackContext(
        threadMessages,
        event as unknown as { user?: string; text?: string },
        userNameCache
      );
      const authorName = await resolveUserName(app, userId);
      const directAsk = `${authorName}: ${event.text || ""}`;

      // Conversation key: use thread_ts for threads, channel for top-level
      const convKey = `slack:${channel}:${event.thread_ts || event.ts}`;
      const sessionName = `Kimiko — Slack #${channel}`;

      const response = await askKimiko(context, directAsk, convKey, sessionName);
      const formatted = toSlackMarkdown(response);
      const chunks = splitForSlack(formatted);

      for (const chunk of chunks) {
        await say({ text: chunk, thread_ts: threadTs });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg }, "Error handling app_mention");
      const shortErr = errMsg.length > 300 ? errMsg.slice(0, 300) + "…" : errMsg;
      await say({
        text: `Something broke: ${shortErr}`,
        thread_ts: event.thread_ts || event.ts,
      });
    }
  });

  // Handle DMs
  app.event("message", async (args: MessageArgs) => {
    const { event, say } = args;

    // Only handle direct messages (im channel type)
    // Skip bot messages, message_changed, etc.
    if (
      event.channel_type !== "im" ||
      event.subtype ||
      !("user" in event) ||
      !event.user
    ) {
      return;
    }

    const userId = event.user;
    const { allowed } = checkRateLimit(`slack:${userId}`);
    if (!allowed) {
      await say("You're sending too many requests. Chill for a bit and try again.");
      return;
    }

    heartbeat();

    try {
      const authorName = await resolveUserName(app, userId);
      const messageText = "text" in event ? (event.text || "") : "";
      const directAsk = `${authorName}: ${messageText}`;

      const convKey = `slack:dm:${userId}`;
      const response = await askKimiko([], directAsk, convKey, `Kimiko — DM with ${authorName}`);
      const formatted = toSlackMarkdown(response);
      const chunks = splitForSlack(formatted);

      for (const chunk of chunks) {
        await say(chunk);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg }, "Error handling DM");
      const shortErr = errMsg.length > 300 ? errMsg.slice(0, 300) + "…" : errMsg;
      await say(`Something broke: ${shortErr}`);
    }
  });
}
