import { Platform } from 'react-native';
import { logger } from '@/services/logger';

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type NativeErrorUtils = {
  getGlobalHandler?: () => ErrorHandler;
  setGlobalHandler?: (handler: ErrorHandler) => void;
};

export function installGlobalErrorCapture() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onError = (event: ErrorEvent) => {
      logger.error('runtime.unhandled_error', { error: event.error ?? new Error(event.message) });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      logger.error('runtime.unhandled_rejection', { error: event.reason });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }

  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: NativeErrorUtils }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return () => {};
  const previous = errorUtils.getGlobalHandler();
  const handler: ErrorHandler = (error, isFatal) => {
    logger.error('runtime.unhandled_error', { error, context: { step: isFatal ? 'fatal' : 'nonfatal' } });
    previous?.(error, isFatal);
  };
  errorUtils.setGlobalHandler(handler);
  return () => {
    if (errorUtils.getGlobalHandler?.() === handler) errorUtils.setGlobalHandler?.(previous);
  };
}
