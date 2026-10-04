/**
 * Device-only storage (M01-FR-08, F03-FR-06, F04-FR-02). Every access is wrapped:
 * private browsing or blocked storage must never break the app.
 */
import type { HealthCheckInput } from '@identity/rules';

export const HEALTH_CHECK_KEY = 'identity.healthCheck.v1';
export const LARGE_TEXT_KEY = 'identity.largeText';

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the app still works, it just doesn't remember */
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface SavedHealthCheck {
  version: 1;
  savedOn: string;
  input: HealthCheckInput;
}

export function loadSavedHealthCheck(): SavedHealthCheck | null {
  const raw = readStorage(HEALTH_CHECK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedHealthCheck;
    if (parsed?.version !== 1 || typeof parsed.savedOn !== 'string' || typeof parsed.input?.documents !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveHealthCheck(input: HealthCheckInput, savedOn: string): void {
  const value: SavedHealthCheck = { version: 1, savedOn, input };
  writeStorage(HEALTH_CHECK_KEY, JSON.stringify(value));
}

export function clearHealthCheck(): void {
  removeStorage(HEALTH_CHECK_KEY);
}
