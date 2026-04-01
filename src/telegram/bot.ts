import { Bot } from "grammy";
import { config } from "../config.js";
import { registerTelegramHandlers } from "./handlers.js";
import { logger } from "../utils/logger.js";

export async function startTelegram(): Promise<Bot> {
  const bot = new Bot(config.telegram.botToken);

  registerTelegramHandlers(bot);

  // Use long polling
  bot.start({
    onStart: () => {
      logger.info("Telegram bot started (long polling)");
    },
  });

  return bot;
}
