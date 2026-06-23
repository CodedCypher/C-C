import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';

/** Profile-derived object handed back to the controller as `req.user`. */
export interface GoogleUserProfile {
  email: string;
  googleId: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
}

/** True only when real Google OAuth credentials are present in the env. */
export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * GoogleStrategy is always registered so the app boots even WITHOUT Google env
 * vars. passport-oauth2 throws on a falsy clientID, so we fall back to a
 * NON-EMPTY placeholder — the app boots, email/password auth works, and the
 * Google route returns a clean 503 (see GoogleOAuthGuard) until real creds are
 * set. See SETUP.md.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'google-oauth-not-configured',
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || 'google-oauth-not-configured',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email =
      profile.emails?.[0]?.value ?? `${profile.id}@google.local`;
    const emailVerified = Boolean(
      (profile.emails?.[0] as { verified?: boolean } | undefined)?.verified ??
        false,
    );
    const user: GoogleUserProfile = {
      email,
      googleId: profile.id,
      firstName: profile.name?.givenName ?? null,
      lastName: profile.name?.familyName ?? null,
      emailVerified,
    };
    done(null, user);
  }
}
