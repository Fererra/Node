export type LogLine = Record<string, unknown>;

/**
 * Captures the app's JSON log lines at `debug`, where `shared/db` logs
 * every query (`db query`) and `withRetry` every attempt (`attempt`).
 */
export function captureLogs() {
  const lines: LogLine[] = [];
  return {
    lines,
    logger: {
      level: 'debug',
      stream: {
        write(line: string) {
          lines.push(JSON.parse(line) as LogLine);
        },
      },
    },
    /** SQL statements run for one request, BEGIN / COMMIT included. */
    queries(requestId: string): string[] {
      return lines
        .filter((l) => l.msg === 'db query' && l.requestId === requestId)
        .map((l) => String(l.query));
    },
    /** `attempt` of every `withRetry` attempt, in order. */
    attempts(requestId?: string): number[] {
      return lines
        .filter(
          (l) =>
            l.msg === 'attempt started' &&
            (requestId === undefined || l.requestId === requestId),
        )
        .map((l) => Number(l.attempt));
    },
    messages(msg: string): LogLine[] {
      return lines.filter((l) => l.msg === msg);
    },
  };
}
