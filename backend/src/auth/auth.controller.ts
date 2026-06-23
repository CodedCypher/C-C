import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { UserRole } from '../generated/prisma/client';
import {
  AuthService,
  type PublicUser,
  type RequestMeta,
} from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import type { JwtUser } from './strategies/jwt.strategy';
import type { GoogleUserProfile } from './strategies/google.strategy';
import {
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
  REFRESH_COOKIE,
} from './auth.constants';
import type { User } from '../generated/prisma/client';

const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.STAFF,
  UserRole.SUPERADMIN,
];

function metaFromReq(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    undefined;
  return {
    userAgent: typeof ua === 'string' ? ua : undefined,
    ip,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/register ───────────────────────────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, tokens } = await this.authService.register(
      dto,
      metaFromReq(req),
    );
    setAccessCookie(res, tokens.accessToken);
    setRefreshCookie(res, tokens.refreshToken);
    return { user };
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────
  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() _dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    // LocalAuthGuard populated req.user with the validated User.
    const user = req.user as User;
    const tokens = await this.authService.issueTokens(user, metaFromReq(req));
    setAccessCookie(res, tokens.accessToken);
    setRefreshCookie(res, tokens.refreshToken);
    return { user: this.authService.toPublicUser(user) };
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const raw = readRefreshCookie(req);
    const tokens = await this.authService.rotateRefreshToken(
      raw,
      metaFromReq(req),
    );
    if (!tokens) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Invalid refresh token');
    }
    setAccessCookie(res, tokens.accessToken);
    setRefreshCookie(res, tokens.refreshToken);
    return { ok: true };
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.authService.revokeRefreshToken(readRefreshCookie(req));
    clearAuthCookies(res);
    return { ok: true };
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request): Promise<{
    user: {
      id: string;
      email: string;
      role: UserRole;
      firstName: string | null;
      lastName: string | null;
      status: string;
    };
  }> {
    const jwtUser = req.user as JwtUser;
    const user = await this.authService.getMe(jwtUser.id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { user };
  }

  // ── GET /auth/google ──────────────────────────────────────────────────────
  // GoogleOAuthGuard kicks off the OAuth redirect (and carries ?next via state).
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  googleAuth(): void {}

  // ── GET /auth/google/callback ─────────────────────────────────────────────
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user as GoogleUserProfile;
    const user = await this.authService.findOrCreateGoogleUser(profile);
    const tokens = await this.authService.issueTokens(user, metaFromReq(req));
    setAccessCookie(res, tokens.accessToken);
    setRefreshCookie(res, tokens.refreshToken);

    const next =
      typeof req.query.state === 'string' ? req.query.state : '';
    const isStaff = STAFF_ROLES.includes(user.role);
    const target =
      next && next !== '/' ? next : isStaff ? '/admin' : '/';
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontend}${target}`);
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[REFRESH_COOKIE];
}
