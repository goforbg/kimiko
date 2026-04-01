import dotenv from "dotenv";
dotenv.config();

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || "",
    appToken: process.env.SLACK_APP_TOKEN || "",
    signingSecret: process.env.SLACK_SIGNING_SECRET || "",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  },
  logLevel: (process.env.LOG_LEVEL || "info") as string,
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || "50", 10),
  maxTokens: parseInt(process.env.MAX_TOKENS || "4096", 10),
  rateLimitPerUser: parseInt(process.env.RATE_LIMIT_PER_USER || "30", 10),
} as const;
