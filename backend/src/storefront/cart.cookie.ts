import type { CookieOptions, Response } from 'express';

/**
 * Guest-cart cookie. Mirrors the auth cookie conventions (httpOnly, SameSite=Lax
 * in dev, Secure in prod) but lives much longer — a shopper's cart should
 * survive across visits. Holds an opaque session token that maps to
 * `Cart.sessionToken`; the browser never reads it in JS.
 */
export const CART_COOKIE = 'cr_cart';

export const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

function baseCartCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setCartCookie(res: Response, token: string): void {
  res.cookie(CART_COOKIE, token, {
    ...baseCartCookieOptions(),
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export function clearCartCookie(res: Response): void {
  res.clearCookie(CART_COOKIE, baseCartCookieOptions());
}
