/**
 * Convert standard markdown to Slack mrkdwn format.
 */
export function toSlackMarkdown(text: string): string {
  return (
    text
      // Bold: **text** or __text__ -> *text*
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      .replace(/__(.+?)__/g, "*$1*")
      // Italic: *text* (single) -> _text_ (but avoid breaking bold)
      // Skip this since single * is already Slack bold
      // Strikethrough: ~~text~~ -> ~text~
      .replace(/~~(.+?)~~/g, "~$1~")
      // Headers: # text -> *text*
      .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
      // Inline code stays the same: `code`
      // Code blocks stay the same: ```code```
      // Links: [text](url) -> <url|text>
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
  );
}

/**
 * Split a long message at paragraph boundaries for Slack's 3000-char limit.
 */
export function splitForSlack(text: string, maxLen = 3000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a paragraph boundary
    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (splitIdx < maxLen * 0.3) {
      // If paragraph boundary is too early, split at line break
      splitIdx = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      // Last resort: split at space
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx < 1) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}
