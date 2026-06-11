import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type {
  AclPermission,
  AuthSession,
  LanguagePreference,
  ThemePreference,
  User,
  Role,
} from "../../types/auth";
import { toRole, toUser } from "../utils/authMappers";
import {
  clearSession,
  getSessionToken,
  getStoredSession,
  saveSession,
  updateStoredSession,
} from "../utils/session";

function buildSession(
  sessionToken: string,
  apiUser: Parameters<typeof toUser>[0],
  apiRole: Parameters<typeof toRole>[0],
): AuthSession {
  return {
    sessionToken,
    user: toUser(apiUser),
    role: toRole(apiRole),
    savedAt: Date.now(),
  };
}

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  user: User | null;
  role: Role | null;
  acl: AclPermission[];
  sessionToken: string | null;
  login: (idToken: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  updateTheme: (theme: ThemePreference) => Promise<void>;
  updateLanguage: (language: LanguagePreference) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    getSessionToken(),
  );
  const [localSession, setLocalSession] = useState<AuthSession | null>(() =>
    getStoredSession(),
  );

  const currentUser = useQuery(
    api.auth.getCurrentUser,
    sessionToken ? { sessionToken } : "skip",
  );

  const authenticate = useAction(api.authActions.authenticateWithGoogle);
  const logoutMutation = useMutation(api.auth.logout);
  const updateProfileMutation = useMutation(api.auth.updateProfile);
  const refreshSessionMutation = useMutation(api.auth.refreshSession);

  useEffect(() => {
    if (sessionToken) {
      void refreshSessionMutation({ sessionToken }).catch(() => {
        clearSession();
        setSessionToken(null);
        setLocalSession(null);
      });
    }
  }, [sessionToken, refreshSessionMutation]);

  useEffect(() => {
    if (currentUser === null && sessionToken) {
      clearSession();
      setSessionToken(null);
      setLocalSession(null);
    }
  }, [currentUser, sessionToken]);

  useEffect(() => {
    if (currentUser && sessionToken) {
      const session = buildSession(
        sessionToken,
        currentUser.user,
        currentUser.role,
      );
      saveSession(session);
      setLocalSession(session);
    }
  }, [currentUser, sessionToken]);

  const login = useCallback(
    async (idToken: string): Promise<AuthSession> => {
      const result = await authenticate({ idToken });
      const session = buildSession(
        result.sessionToken,
        result.user,
        result.role,
      );
      saveSession(session);
      setSessionToken(result.sessionToken);
      setLocalSession(session);
      return session;
    },
    [authenticate],
  );

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutMutation({ sessionToken });
      } catch {
        // Clear local session even if server logout fails
      }
    }
    clearSession();
    setSessionToken(null);
    setLocalSession(null);
  }, [sessionToken, logoutMutation]);

  const updateTheme = useCallback(
    async (theme: ThemePreference) => {
      if (!sessionToken) return;
      const result = await updateProfileMutation({ sessionToken, theme });
      const user = toUser(result.user);
      const role = toRole(result.role);
      updateStoredSession({ user, role });
      setLocalSession((prev) => (prev ? { ...prev, user, role } : prev));
    },
    [sessionToken, updateProfileMutation],
  );

  const updateLanguage = useCallback(
    async (language: LanguagePreference) => {
      if (!sessionToken) return;
      const result = await updateProfileMutation({ sessionToken, language });
      const user = toUser(result.user);
      const role = toRole(result.role);
      updateStoredSession({ user, role });
      setLocalSession((prev) => (prev ? { ...prev, user, role } : prev));
    },
    [sessionToken, updateProfileMutation],
  );

  const user = currentUser
    ? toUser(currentUser.user)
    : (localSession?.user ?? null);
  const role = currentUser
    ? toRole(currentUser.role)
    : (localSession?.role ?? null);
  const acl = role?.acl ?? [];

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: sessionToken !== null && currentUser === undefined,
      isAuthenticated: !!user && !!sessionToken,
      isApproved: user?.status === "APPROVED",
      user,
      role,
      acl,
      sessionToken,
      login,
      logout,
      updateTheme,
      updateLanguage,
    }),
    [
      sessionToken,
      currentUser,
      user,
      role,
      acl,
      login,
      logout,
      updateTheme,
      updateLanguage,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
