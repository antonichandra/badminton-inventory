import type { AuthSession } from "../../types/auth";

const SESSION_STORAGE_KEY = "bi_auth_session";

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return getStoredSession()?.sessionToken ?? null;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function updateStoredSession(partial: Partial<AuthSession>): void {
  const current = getStoredSession();
  if (!current) return;
  saveSession({ ...current, ...partial, savedAt: Date.now() });
}
