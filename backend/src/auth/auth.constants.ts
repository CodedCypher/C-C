import type { CookieOptions, Response } from 'express';

/**
 * Centralized cookie names + options so set and clear stay consistent.
 * - Access cookie (`cr_at`) holds the signed access JWT (15m).
 * - Refresh cookie (`cr_rt`) holds the RAW opaque refresh token (7d); its
 *   SHA-256 hash is what we persist in Session.token.
 */
export const ACCESS_COOKIE = 'cr_at';
export const REFRESH_COOKIE = 'cr_rt';

export const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE, rawToken, {
    ...baseCookieOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(res: Response): void {
  // clearCookie must use the SAME flags (sans maxAge) the cookies were set with.
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}
