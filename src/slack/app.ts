import { App } from "@slack/bolt";
import { config } from "../config.js";
import { registerSlackHandlers } from "./handlers.js";
import { logger } from "../utils/logger.js";

export async function startSlack(): Promise<App> {
  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
  });

  registerSlackHandlers(app);

  await app.start();
  logger.info("Slack bot started (Socket Mode)");

  return app;
}
