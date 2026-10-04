export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  Silent = 4,
}

export interface LogEntry {
  time: number;
  level: LogLevel;
  scope: string;
  message: string;
}

const RING_SIZE = 200;
const ring: LogEntry[] = [];
let globalLevel: LogLevel = LogLevel.Info;

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function getLogLevel(): LogLevel {
  return globalLevel;
}

/** Recent log lines, kept for the debug overlay and QA bug reports. */
export function recentLogs(): readonly LogEntry[] {
  return ring;
}

function record(level: LogLevel, scope: string, message: string): void {
  ring.push({ time: Date.now(), level, scope, message });
  if (ring.length > RING_SIZE) ring.shift();
}

function stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  const emit = (level: LogLevel, args: unknown[]) => {
    if (level < globalLevel) return;
    const message = stringify(args);
    record(level, scope, message);
    const line = `[${scope}] ${message}`;
    if (level >= LogLevel.Error) console.error(line);
    else if (level === LogLevel.Warn) console.warn(line);
    else if (level === LogLevel.Info) console.info(line);
    else console.debug(line);
  };
  return {
    debug: (...a) => emit(LogLevel.Debug, a),
    info: (...a) => emit(LogLevel.Info, a),
    warn: (...a) => emit(LogLevel.Warn, a),
    error: (...a) => emit(LogLevel.Error, a),
  };
}
