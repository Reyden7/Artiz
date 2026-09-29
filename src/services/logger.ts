import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase/client';

type Level = 'debug' | 'info' | 'warn' | 'error';
type LogOptions = {
  context?: Record<string, unknown>;
  error?: unknown;
  correlationId?: string;
};

export type TechnicalLog = {
  level: Level;
  message: string;
  context: Record<string, string>;
  user_id: string | null;
  route: string | null;
  platform: 'android' | 'ios' | 'web';
  app_version: string;
  build_version: string | null;
  correlation_id: string | null;
  error_name: string | null;
  error_message: string | null;
  stack_trace: string | null;
  created_at: string;
};

const allowedContext = new Set([
  'operation', 'screen', 'bucket', 'status_code', 'error_code', 'step', 'retry', 'correlation_id',
]);
const localPrefix = 'artiz.technical-logs.';
let activeUserId: string | null = null;
let activeRoute: string | null = null;
let localWrite = Promise.resolve();
let sentWindowStart = 0;
let sentInWindow = 0;
const lastSent = new Map<string, number>();
const pendingRemote = new Set<Promise<unknown>>();

export function redactTechnicalText(value: string): string {
  return value
    .replace(/(access_token|refresh_token|password|token_hash|authorization|apikey|siret)\s*[:=]\s*[^\s&;,}]+/gi, '$1=[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .replace(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\d{14}/g, '[number]')
    .replace(/([?&][A-Za-z_]+)=([^&\s]+)/g, '$1=[redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[secret]');
}

function safeContext(context?: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(context ?? {})) {
    if (!allowedContext.has(key) || !['string', 'number', 'boolean'].includes(typeof value)) continue;
    result[key] = redactTechnicalText(String(value)).slice(0, 120);
  }
  return result;
}

function safeError(error: unknown) {
  if (!error || typeof error !== 'object') return { name: null, message: null, stack: null };
  const details = error as { name?: unknown; message?: unknown; stack?: unknown };
  return {
    name: typeof details.name === 'string' ? redactTechnicalText(details.name).slice(0, 120) : null,
    message: typeof details.message === 'string'
      ? redactTechnicalText(details.message).replace(/(['"])[^'"\n]{1,500}\1/g, '$1[redacted]$1').slice(0, 500)
      : null,
    stack: typeof details.stack === 'string' ? redactTechnicalText(details.stack).slice(0, 4000) : null,
  };
}

function persistLocally(entry: TechnicalLog) {
  const key = `${localPrefix}${entry.user_id ?? 'anonymous'}`;
  localWrite = localWrite.then(async () => {
    const raw = await AsyncStorage.getItem(key);
    let previous: TechnicalLog[] = [];
    try { previous = raw ? JSON.parse(raw) as TechnicalLog[] : []; } catch { /* discard damaged journal */ }
    const recent = previous.filter((item) => Date.now() - Date.parse(item.created_at) < 7 * 86400_000).slice(-99);
    await AsyncStorage.setItem(key, JSON.stringify([...recent, entry]));
  }).catch(() => { /* logging must never interrupt the user's action */ });
}

function sendRemotely(entry: TechnicalLog) {
  if (!supabase || !entry.user_id || (entry.level !== 'warn' && entry.level !== 'error')) return;
  const now = Date.now();
  if (now - sentWindowStart > 60_000) { sentWindowStart = now; sentInWindow = 0; }
  const key = `${entry.user_id}:${entry.message}:${entry.route}:${entry.error_name}`;
  if (sentInWindow >= 15 || now - (lastSent.get(key) ?? 0) < 10_000) return;
  lastSent.set(key, now);
  sentInWindow += 1;
  const request = Promise.resolve(supabase.from('app_logs').insert({
    user_id: entry.user_id,
    level: entry.level,
    message: entry.message,
    context: entry.context,
    error_name: entry.error_name,
    error_message: entry.error_message,
    stack_trace: entry.stack_trace,
    correlation_id: entry.correlation_id,
    route: entry.route,
    platform: entry.platform,
    app_version: entry.app_version,
    build_version: entry.build_version,
  })).then(() => { /* best effort; do not recursively log telemetry failures */ });
  pendingRemote.add(request);
  void request.finally(() => pendingRemote.delete(request));
}

function record(level: Level, message: string, options: LogOptions = {}) {
  const safeMessage = /^[a-z0-9._-]{3,100}$/.test(message) ? message : 'app.unclassified_event';
  const error = safeError(options.error);
  const platform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'web';
  const nativeBuild = platform === 'android'
    ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber;
  const entry: TechnicalLog = {
    level, message: safeMessage, context: safeContext(options.context),
    user_id: activeUserId,
    route: activeRoute ? redactTechnicalText(activeRoute).slice(0, 200) : null,
    platform,
    app_version: Constants.expoConfig?.version ?? 'unknown',
    build_version: nativeBuild == null ? null : String(nativeBuild),
    correlation_id: options.correlationId?.match(/^[a-z0-9-]{1,64}$/) ? options.correlationId : null,
    error_name: error.name, error_message: error.message, stack_trace: error.stack,
    created_at: new Date().toISOString(),
  };
  if (__DEV__) console.info(`[Artiz ${level}] ${safeMessage}`, entry.context);
  persistLocally(entry);
  sendRemotely(entry);
  return entry;
}

export const logger = {
  debug: (message: string, options?: LogOptions) => record('debug', message, options),
  info: (message: string, options?: LogOptions) => record('info', message, options),
  warn: (message: string, options?: LogOptions) => record('warn', message, options),
  error: (message: string, options?: LogOptions) => record('error', message, options),
  setUserId: (userId: string | null) => { activeUserId = userId; },
  setRoute: (route: string | null) => { activeRoute = route; },
  newCorrelationId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  localEntries: async (userId: string | null) => {
    try {
      const raw = await AsyncStorage.getItem(`${localPrefix}${userId ?? 'anonymous'}`);
      return raw ? JSON.parse(raw) as TechnicalLog[] : [];
    } catch { return [] as TechnicalLog[]; }
  },
  flush: async () => {
    await Promise.race([
      Promise.allSettled([...pendingRemote]),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  },
};
