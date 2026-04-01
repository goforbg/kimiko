import { logger } from "./logger.js";

export function setupGlobalErrorHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled rejection");
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    process.exit(1);
  });
}

export function wrapHandler<T extends (...args: never[]) => Promise<void>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      await fn(...args);
    } catch (err) {
      logger.error({ err }, "Handler error");
    }
  }) as T;
}
