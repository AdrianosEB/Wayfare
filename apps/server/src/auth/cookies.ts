import type { Request, Response } from "express";

/**
 * Session cookie helpers (docs/AUTH_CONTRACT.md "Session cookie").
 *
 *   wf_session=<opaque id>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
 *
 * `Secure` is set ONLY in production (so plain-HTTP local dev still works). HttpOnly keeps the
 * cookie out of `document.cookie` (XSS-exfiltration defense); SameSite=Lax is CSRF-friendly.
 */

export const SESSION_COOKIE = "wf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const isProd = (): boolean => process.env.NODE_ENV === "production";

/** Read the session id from the parsed cookies (cookie-parser populates `req.cookies`). */
export function readSessionCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const value = cookies?.[SESSION_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Set the session cookie. */
export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS * 1000, // express expects ms
    secure: isProd(),
  });
}

/** Clear the session cookie. Attributes must match those used when setting it. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd(),
  });
}
