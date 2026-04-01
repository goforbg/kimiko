import { config } from "./config.js";
import { startSlack } from "./slack/app.js";
import { startTelegram } from "./telegram/bot.js";
import { setupGlobalErrorHandlers } from "./utils/error-handler.js";
import { startWatchdog } from "./utils/watchdog.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  setupGlobalErrorHandlers();

  logger.info("Starting Kimiko...");

  let slackOk = false;
  let telegramOk = false;

  // Start Slack
  try {
    if (config.slack.botToken && config.slack.appToken) {
      await startSlack();
      slackOk = true;
    } else {
      logger.warn("Slack tokens not configured — skipping Slack bot");
    }
  } catch (err) {
    logger.error({ err }, "Failed to start Slack bot");
  }

  // Start Telegram
  try {
    if (config.telegram.botToken) {
      await startTelegram();
      telegramOk = true;
    } else {
      logger.warn("Telegram token not configured — skipping Telegram bot");
    }
  } catch (err) {
    logger.error({ err }, "Failed to start Telegram bot");
  }

  const status = [
    slackOk ? "Slack \u2713" : "Slack \u2717",
    telegramOk ? "Telegram \u2713" : "Telegram \u2717",
  ].join(" ");

  logger.info(`Kimiko is online — ${status}`);

  startWatchdog();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
