import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified: string | boolean;
  exp: string;
  aud?: string;
}

function isEmailVerified(value: string | boolean | undefined): boolean {
  return value === true || value === "true";
}

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleTokenPayload> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!response.ok) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  const payload = (await response.json()) as GoogleTokenPayload;

  if (!isEmailVerified(payload.email_verified)) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  return payload;
}

export function getGoogleDisplayName(payload: GoogleTokenPayload): string {
  return payload.name?.trim() || payload.email.split("@")[0] || "User";
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function getSessionExpiry(): number {
  return Date.now() + SESSION_DURATION_MS;
}

export async function getUserBySessionToken(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
): Promise<{ user: Doc<"users">; sessionId: Id<"sessions"> } | null> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  const user = await ctx.db.get(session.userId);
  if (!user) {
    return null;
  }

  return { user, sessionId: session._id };
}

export async function getRoleById(
  ctx: QueryCtx | MutationCtx,
  roleId: Id<"roles">,
): Promise<Doc<"roles"> | null> {
  return await ctx.db.get(roleId);
}

export async function getUserByEmail(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<Doc<"users"> | null> {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  const byNormalized = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalized))
    .unique();
  if (byNormalized) {
    return byNormalized;
  }

  if (trimmed !== normalized) {
    const byOriginal = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", trimmed))
      .unique();
    if (byOriginal) {
      return byOriginal;
    }
  }

  const users = await ctx.db.query("users").collect();
  return (
    users.find((user) => user.email.trim().toLowerCase() === normalized) ?? null
  );
}
