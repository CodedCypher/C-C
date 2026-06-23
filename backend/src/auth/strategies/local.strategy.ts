import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import type { User } from '../../generated/prisma/client';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  // Throws UnauthorizedException on bad creds (handled inside the service).
  async validate(email: string, password: string): Promise<User> {
    return this.authService.validateCredentials(email, password);
  }
}
