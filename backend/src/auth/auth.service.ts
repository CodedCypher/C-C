import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus, type User } from '../generated/prisma/client';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS } from './auth.constants';

const BCRYPT_SALT_ROUNDS = 10;

/** Public-facing user shape returned by auth endpoints. */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}

/** Access-token JWT payload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** A freshly minted token pair: signed access JWT + raw refresh token. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // RAW token (goes in the cookie)
}

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

interface GoogleProfileInput {
  email: string;
  googleId: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toPublicUser(u: {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  toPublicUser = toPublicUser;

  // ── Local credential validation (used by LocalStrategy) ─────────────────────
  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (
      !user ||
      user.deletedAt ||
      !user.passwordHash ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  // ── Registration ────────────────────────────────────────────────────────────
  async register(
    input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    },
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        customerProfile: { create: {} },
      },
    });

    const tokens = await this.issueTokens(user, meta);
    return { user: toPublicUser(user), tokens };
  }

  // ── Token issuance (access JWT + refresh session) ───────────────────────────
  async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const rawRefresh = randomBytes(32).toString('hex');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: sha256(rawRefresh),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  // ── Refresh rotation ─────────────────────────────────────────────────────────
  // Returns null on any failure so the controller can clear cookies + 401.
  async rotateRefreshToken(
    rawToken: string | undefined,
    meta: RequestMeta,
  ): Promise<IssuedTokens | null> {
    if (!rawToken) return null;
    const hashed = sha256(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { token: hashed },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      // Revoke the session for a gone/suspended user before bailing.
      await this.prisma.session
        .update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
      return null;
    }

    // Rotate: revoke the old session, mint a brand-new one.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user, meta);
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async revokeRefreshToken(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const hashed = sha256(rawToken);
    await this.prisma.session
      .updateMany({
        where: { token: hashed, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  // ── Current user (for GET /auth/me) ──────────────────────────────────────────
  async getMe(userId: string): Promise<{
    id: string;
    email: string;
    role: UserRole;
    firstName: string | null;
    lastName: string | null;
    status: UserStatus;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.deletedAt) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    };
  }

  // ── Google OAuth: find/link/create then issue tokens ─────────────────────────
  async findOrCreateGoogleUser(profile: GoogleProfileInput): Promise<User> {
    const email = profile.email.toLowerCase().trim();

    // 1. Match by googleId.
    const byGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogle) return byGoogle;

    // 2. Match by email → link the Google account.
    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        },
      });
    }

    // 3. Create a brand-new Google-only customer (no password).
    return this.prisma.user.create({
      data: {
        email,
        googleId: profile.googleId,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        emailVerifiedAt: new Date(),
        customerProfile: { create: {} },
      },
    });
  }
}
