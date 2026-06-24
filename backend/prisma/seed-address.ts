/**
 * Seed the Philippine address reference tables (PSGC) used by the storefront
 * checkout's cascading region → province → city/municipality → barangay
 * dropdowns. Idempotent: `createMany({ skipDuplicates: true })` keyed on the
 * dataset codes, batched (barangays are ~42k rows).
 *
 * Source data: prisma/dataset/{refregion,refprovince,refcitymun,refbrgy}.json
 * (each shaped `{ "RECORDS": [...] }`). Run: `pnpm seed:address`.
 *
 * NOTE: refcitymun records carry the region code under the (mislabeled) key
 * `regDesc`; the RefCityMun table links to its province via `provCode` only.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DATASET = join(__dirname, 'dataset');
const BATCH = 5000;

/** Read a `{ RECORDS: [...] }` dataset file into its record array. */
function records<T>(file: string): T[] {
  const raw = JSON.parse(readFileSync(join(DATASET, file), 'utf8')) as {
    RECORDS?: T[];
  };
  return raw.RECORDS ?? [];
}

/** createMany in chunks so a 42k-row insert doesn't blow query limits. */
async function insertChunked<T>(
  label: string,
  rows: T[],
  create: (chunk: T[]) => Promise<{ count: number }>,
): Promise<void> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await create(rows.slice(i, i + BATCH));
    inserted += res.count;
  }
  console.log(`  ${label}: ${inserted} inserted (${rows.length} total)`);
}

type RegionRow = { psgcCode: string; regDesc: string; regCode: string };
type ProvinceRow = {
  psgcCode: string;
  provDesc: string;
  regCode: string;
  provCode: string;
};
type CityMunRow = {
  psgcCode: string;
  citymunDesc: string;
  regDesc: string; // holds the region code
  provCode: string;
  citymunCode: string;
};
type BarangayRow = {
  brgyCode: string;
  brgyDesc: string;
  regCode: string;
  provCode: string;
  citymunCode: string;
};

async function main() {
  console.log('Seeding PH address reference data...');

  await insertChunked('regions', records<RegionRow>('refregion.json'), (chunk) =>
    prisma.refRegion.createMany({
      data: chunk.map((r) => ({
        regCode: r.regCode,
        psgcCode: r.psgcCode,
        regDesc: r.regDesc,
      })),
      skipDuplicates: true,
    }),
  );

  await insertChunked(
    'provinces',
    records<ProvinceRow>('refprovince.json'),
    (chunk) =>
      prisma.refProvince.createMany({
        data: chunk.map((r) => ({
          provCode: r.provCode,
          regCode: r.regCode,
          psgcCode: r.psgcCode,
          provDesc: r.provDesc,
        })),
        skipDuplicates: true,
      }),
  );

  await insertChunked(
    'cities/municipalities',
    records<CityMunRow>('refcitymun.json'),
    (chunk) =>
      prisma.refCityMun.createMany({
        data: chunk.map((r) => ({
          citymunCode: r.citymunCode,
          provCode: r.provCode,
          psgcCode: r.psgcCode,
          citymunDesc: r.citymunDesc,
        })),
        skipDuplicates: true,
      }),
  );

  await insertChunked(
    'barangays',
    records<BarangayRow>('refbrgy.json'),
    (chunk) =>
      prisma.refBarangay.createMany({
        data: chunk.map((r) => ({
          brgyCode: r.brgyCode,
          citymunCode: r.citymunCode,
          provCode: r.provCode,
          regCode: r.regCode,
          brgyDesc: r.brgyDesc,
        })),
        skipDuplicates: true,
      }),
  );

  console.log('PH address reference data seeded.');
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
