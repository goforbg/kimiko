import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { logger } from "../utils/logger.js";

const SESSION_FILE = resolve(
  import.meta.dirname,
  "../../.sessions.json"
);

// Load persisted sessions from disk
const sessionMap = new Map<string, string>(
  (() => {
    try {
      if (existsSync(SESSION_FILE)) {
        const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
        return Object.entries(data) as [string, string][];
      }
    } catch {
      logger.warn("Failed to load sessions file, starting fresh");
    }
    return [];
  })()
);

function persistSessions(): void {
  try {
    const obj = Object.fromEntries(sessionMap);
    writeFileSync(SESSION_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    logger.warn({ err }, "Failed to persist sessions");
  }
}

export function getSessionId(conversationKey: string): string | undefined {
  return sessionMap.get(conversationKey);
}

export async function askKimiko(
  contextMessages: string[],
  directAsk: string,
  conversationKey: string,
  sessionName?: string
): Promise<string> {
  const prompt = [
    ...contextMessages.map((m) => `[Context] ${m}`),
    `[Current message] ${directAsk}`,
  ].join("\n");

  const existingSession = sessionMap.get(conversationKey);

  try {
    logger.debug(
      { promptLength: prompt.length, conversationKey, existingSession: !!existingSession },
      "Calling Claude Code SDK"
    );

    const abortController = new AbortController();
    // 5 minute timeout (vs old 2 min) — SDK handles streaming so this is generous
    const timeout = setTimeout(() => abortController.abort(), 300_000);

    const options: Parameters<typeof query>[0]["options"] = {
      abortController,
      model: "sonnet",
      tools: { type: "preset", preset: "claude_code" },
      allowedTools: [
        "Bash", "Read", "Write", "Edit", "Glob", "Grep",
        "WebSearch", "WebFetch", "Agent",
      ],
      maxBudgetUsd: 0.50,
      systemPrompt: existingSession ? undefined : SYSTEM_PROMPT,
    };

    if (existingSession) {
      options.resume = existingSession;
    }

    let resultText = "";
    let sessionId = "";

    for await (const message of query({ prompt, options })) {
      if (message.type === "assistant") {
        sessionId = message.session_id;
        // Extract text from the assistant message content blocks
        for (const block of message.message.content) {
          if (block.type === "text") {
            resultText = block.text;
          }
        }
      } else if (message.type === "result") {
        if (message.subtype === "success" && message.result) {
          resultText = message.result;
        } else if ("error" in message) {
          const errMsg = (message as { error?: string }).error || "Unknown error";
          throw new Error(`SDK result error: ${errMsg}`);
        }
      }
    }

    clearTimeout(timeout);

    // Store session ID for future messages in this conversation
    if (sessionId) {
      sessionMap.set(conversationKey, sessionId);
      persistSessions();
      logger.debug(
        { conversationKey, sessionId },
        "Session stored"
      );
    }

    return resultText || "I got nothing back from my brain. Try again in a sec.";
  } catch (err: unknown) {
    const error = err as Error;
    const errorDetail = error.message || String(err);
    logger.error({ err: errorDetail, conversationKey }, "Claude Code SDK failed");

    // If resume failed (session expired/corrupted), clear it and retry without resume
    if (existingSession) {
      logger.warn({ conversationKey }, "Clearing stale session, retrying fresh");
      sessionMap.delete(conversationKey);
      persistSessions();
      return askKimiko(contextMessages, directAsk, conversationKey, sessionName);
    }

    if (errorDetail.includes("auth")) {
      return "Auth issue with Claude Code. BG needs to run `claude auth` on the server.";
    }

    // Return actual error details instead of generic message
    const shortErr = errorDetail.length > 300
      ? errorDetail.slice(0, 300) + "…"
      : errorDetail;
    return `Claude errored out: ${shortErr}`;
  }
}
