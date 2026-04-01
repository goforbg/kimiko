import type { Bot, Context } from "grammy";
import { askKimiko } from "../ai/client.js";
import { buildTelegramContext } from "../ai/context-builder.js";
import { splitForTelegram } from "./formatters.js";
import { checkRateLimit } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { heartbeat } from "../utils/watchdog.js";

interface BufferedMessage {
  authorName: string;
  text: string;
  ts: number;
}

// In-memory message buffer per chat
const chatBuffers = new Map<number, BufferedMessage[]>();
const MAX_BUFFER = 50;

function addToBuffer(chatId: number, msg: BufferedMessage): void {
  let buffer = chatBuffers.get(chatId);
  if (!buffer) {
    buffer = [];
    chatBuffers.set(chatId, buffer);
  }
  buffer.push(msg);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
}

function getAuthorName(ctx: Context): string {
  const from = ctx.from;
  if (!from) return "Unknown";
  if (from.first_name && from.last_name) {
    return `${from.first_name} ${from.last_name}`;
  }
  return from.first_name || from.username || "Unknown";
}

function shouldRespond(ctx: Context, botId: number | undefined): boolean {
  const chatType = ctx.chat?.type;

  // Always respond in private chats
  if (chatType === "private") return true;

  // In groups, only respond if "kimiko" is mentioned or it's a reply to the bot
  const text = ctx.message?.text || "";
  if (/kimiko/i.test(text)) return true;

  // Check if replying to the bot
  const replyTo = ctx.message?.reply_to_message;
  if (replyTo && replyTo.from?.id === botId) return true;

  return false;
}

export function registerTelegramHandlers(bot: Bot): void {
  let botUserId: number | undefined;

  bot.api.getMe().then((me) => {
    botUserId = me.id;
    logger.info({ botUsername: me.username }, "Telegram bot identity resolved");
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const authorName = getAuthorName(ctx);
    const text = ctx.message.text;

    // Enforce allowlist if configured
    if (config.telegram.allowedUserIds.length > 0) {
      const userId = ctx.from?.id?.toString() || "";
      if (!config.telegram.allowedUserIds.includes(userId)) {
        logger.warn({ userId }, "Rejected message from unauthorized Telegram user");
        await ctx.reply("Sorry, you are not authorized to use this bot.");
        return;
      }
    }

    // Always buffer messages for context
    addToBuffer(chatId, {
      authorName,
      text,
      ts: ctx.message.date,
    });

    // Check if we should respond
    if (!shouldRespond(ctx, botUserId)) return;

    const userId = ctx.from?.id?.toString() || "unknown";
    const { allowed } = checkRateLimit(`tg:${userId}`);
    if (!allowed) {
      await ctx.reply(
        "You're sending too many requests. Chill for a bit and try again.",
        { reply_parameters: { message_id: ctx.message.message_id } }
      );
      return;
    }

    heartbeat();

    // Immediately acknowledge so user knows bot is alive
    const ackMsg = await ctx.reply("on it...", {
      reply_parameters: { message_id: ctx.message.message_id },
    });

    // Keep typing indicator alive every 4s while Claude thinks
    const typingInterval = setInterval(() => {
      ctx.api.sendChatAction(chatId, "typing").catch(() => {});
    }, 4000);

    try {
      await ctx.api.sendChatAction(chatId, "typing");

      const buffer = chatBuffers.get(chatId) || [];
      const triggerMsg = { authorName, text };
      const context = buildTelegramContext(buffer, triggerMsg);
      const directAsk = `${authorName}: ${text}`;

      const chatType = ctx.chat?.type || "private";
      const convKey = `tg:${chatId}`;
      const sessionName = chatType === "private"
        ? `Kimiko — TG DM with ${authorName}`
        : `Kimiko — TG group ${ctx.chat?.title || chatId}`;

      const response = await askKimiko(context, directAsk, convKey, sessionName);

      // Delete the "on it..." ack
      await ctx.api.deleteMessage(chatId, ackMsg.message_id).catch(() => {});

      // Split long responses to stay under Telegram's 4096 char limit
      const chunks = splitForTelegram(response);
      for (const chunk of chunks) {
        await ctx.reply(chunk, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errMsg }, "Error handling Telegram message");
      const shortErr = errMsg.length > 300 ? errMsg.slice(0, 300) + "…" : errMsg;

      // Edit the ack message with the error instead of sending a new one
      await ctx.api.editMessageText(chatId, ackMsg.message_id, `Something broke: ${shortErr}`).catch(() => {});
    } finally {
      clearInterval(typingInterval);
    }
  });
}
