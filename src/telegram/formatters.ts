/**
 * Telegram message limit is 4096 characters.
 * Split long responses into chunks, breaking at paragraph/line boundaries.
 */
const TG_MAX_LENGTH = 4096;

export function splitForTelegram(text: string): string[] {
  if (text.length <= TG_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TG_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    let splitAt = -1;
    const searchWindow = remaining.slice(0, TG_MAX_LENGTH);

    // Try splitting at double newline (paragraph break)
    const paraBreak = searchWindow.lastIndexOf("\n\n");
    if (paraBreak > TG_MAX_LENGTH * 0.3) {
      splitAt = paraBreak;
    }

    // Fall back to single newline
    if (splitAt === -1) {
      const lineBreak = searchWindow.lastIndexOf("\n");
      if (lineBreak > TG_MAX_LENGTH * 0.3) {
        splitAt = lineBreak;
      }
    }

    // Fall back to space
    if (splitAt === -1) {
      const spaceBreak = searchWindow.lastIndexOf(" ");
      if (spaceBreak > TG_MAX_LENGTH * 0.3) {
        splitAt = spaceBreak;
      }
    }

    // Hard split as last resort
    if (splitAt === -1) {
      splitAt = TG_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
