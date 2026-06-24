/**
 * Dev-only: upsert a staff/admin user you can actually log in with.
 * The demo seed only creates CUSTOMERs (with a fake password hash), so there is
 * no loginable admin out of the box. Run: `pnpm --dir backend exec tsx prisma/seed-admin.ts`
 *
 * Credentials (override via env): ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole, UserStatus } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const BCRYPT_SALT_ROUNDS = 10; // matches AuthService

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@circuit.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? 'password';
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: UserRole.ADMIN, status: UserStatus.ACTIVE, deletedAt: null },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Admin',
      lastName: 'User',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`\nADMIN READY -> ${user.email} / ${password}  (role=${user.role})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
