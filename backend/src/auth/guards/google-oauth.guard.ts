import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { isGoogleConfigured } from '../strategies/google.strategy';

/**
 * Carries the optional `?next=` query param through the OAuth round-trip by
 * encoding it into the `state` parameter. Google echoes `state` back on the
 * callback, where we read it to decide the post-login redirect target.
 *
 * If Google OAuth credentials are not configured, short-circuits with a clean
 * 503 instead of bouncing the user to Google with a placeholder client id.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!isGoogleConfigured()) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — see SETUP.md.',
      );
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const next = typeof req.query.next === 'string' ? req.query.next : '';
    return { state: next };
  }
}
