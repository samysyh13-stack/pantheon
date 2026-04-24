type Level = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env?.DEV ?? false;

function log(level: Level, scope: string, msg: string, extra?: unknown) {
  if (!isDev && level === 'debug') return;
  const prefix = `[${scope}]`;
  const args: unknown[] = [prefix, msg];
  if (extra !== undefined) args.push(extra);
  // eslint-disable-next-line no-console
  console[level](...args);
}

export const logger = {
  debug: (scope: string, msg: string, extra?: unknown) => log('debug', scope, msg, extra),
  info: (scope: string, msg: string, extra?: unknown) => log('info', scope, msg, extra),
  warn: (scope: string, msg: string, extra?: unknown) => log('warn', scope, msg, extra),
  error: (scope: string, msg: string, extra?: unknown) => log('error', scope, msg, extra),
};
