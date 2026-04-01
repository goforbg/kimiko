import { config } from "../config.js";

const MAX_CHARS = 80_000 * 4; // ~80K tokens at ~4 chars/token

interface SlackMessage {
  user?: string;
  text?: string;
  bot_id?: string;
}

interface TelegramMessage {
  authorName: string;
  text: string;
}

export function buildSlackContext(
  threadMessages: SlackMessage[],
  triggerMessage: SlackMessage,
  userCache: Map<string, string>
): string[] {
  const messages: string[] = [];
  let charCount = 0;

  const toProcess = threadMessages.slice(-config.maxContextMessages);

  for (const msg of toProcess) {
    if (!msg.text) continue;

    const authorName = msg.user
      ? userCache.get(msg.user) || msg.user
      : "bot";
    const cleanText = stripBotMentions(msg.text);
    const line = `${authorName}: ${cleanText}`;

    if (charCount + line.length > MAX_CHARS) break;
    charCount += line.length;
    messages.push(line);
  }

  return messages;
}

export function buildTelegramContext(
  recentMessages: TelegramMessage[],
  triggerMessage: TelegramMessage
): string[] {
  const messages: string[] = [];
  let charCount = 0;

  const toProcess = recentMessages.slice(-config.maxContextMessages);

  for (const msg of toProcess) {
    if (!msg.text) continue;

    const cleanText = stripBotMentions(msg.text);
    const line = `${msg.authorName}: ${cleanText}`;

    if (charCount + line.length > MAX_CHARS) break;
    charCount += line.length;
    messages.push(line);
  }

  return messages;
}

function stripBotMentions(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, "") // Slack mentions
    .replace(/@kimiko/gi, "") // Telegram mentions
    .trim();
}
