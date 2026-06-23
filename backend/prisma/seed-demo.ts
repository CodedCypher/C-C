/**
 * Richer DEMO seed for circuit.rocks — makes the admin dashboard look ALIVE.
 *
 * This is UI demo data. It sets StockItem buckets (onHand/reserved/incoming)
 * DIRECTLY and does NOT maintain the movement-ledger invariant rigor of
 * `seed.ts` (which is left untouched). Re-runnable: it TRUNCATEs all tables
 * first. Run: `npm run seed:demo`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type {
  OrderStatus,
  ProductStatus,
  BuildStatus,
  POStatus,
  SalesChannel,
} from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const money = (n: number) => n.toFixed(2);
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length];

// Split a StockItem's buckets across warehouses so Σ WarehouseStockItem == StockItem rollup.
// ~60% on-hand in the Main DC, the rest in the QC backroom; reserved/incoming sit at the DC.
async function seedWarehouseStock(
  stockItemId: string,
  buckets: { onHand: number; reserved: number; incoming: number },
  mainId: string,
  qcId: string,
) {
  const mainOnHand = Math.round(buckets.onHand * 0.6);
  const qcOnHand = buckets.onHand - mainOnHand;
  await prisma.warehouseStockItem.create({
    data: {
      stockItemId,
      warehouseId: mainId,
      onHand: money(mainOnHand),
      reserved: money(buckets.reserved),
      incoming: money(buckets.incoming),
    },
  });
  if (qcOnHand > 0) {
    await prisma.warehouseStockItem.create({
      data: { stockItemId, warehouseId: qcId, onHand: money(qcOnHand) },
    });
  }
}

async function wipe() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  const tables = rows
    .map((r) => `"public"."${r.tablename}"`)
    .filter((n) => !n.includes('_prisma_migrations'))
    .join(', ');
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
    );
  }
}

async function main() {
  console.log('demo seed: wiping…');
  await wipe();

  // ── Settings + warehouses + branches + bins ──────────────────────────────────
  console.log('settings + warehouses + branches + bins');
  const mainWh = await prisma.warehouse.create({
    data: { name: 'Main DC', code: 'WH-MAIN', type: 'DISTRIBUTION', isDefaultWeb: true, city: 'Manila', region: 'NCR', country: 'PH' },
  });
  const qcWh = await prisma.warehouse.create({
    data: { name: 'Quezon City Backroom', code: 'WH-QC', type: 'RETAIL_BACKROOM', city: 'Quezon City', region: 'NCR', country: 'PH' },
  });
  const cebuWh = await prisma.warehouse.create({
    data: { name: 'Cebu Backroom', code: 'WH-CEB', type: 'RETAIL_BACKROOM', city: 'Cebu City', region: 'Central Visayas', country: 'PH' },
  });

  const qcBranch = await prisma.branch.create({
    data: { name: 'QC Flagship Store', code: 'BR-QC', city: 'Quezon City', region: 'NCR', country: 'PH' },
  });
  const cebuBranch = await prisma.branch.create({
    data: { name: 'Cebu Store', code: 'BR-CEB', city: 'Cebu City', region: 'Central Visayas', country: 'PH' },
  });
  const branches = [qcBranch, cebuBranch];

  await prisma.branchWarehouse.createMany({
    data: [
      // QC store: primary = QC backroom, fallback = Main DC
      { branchId: qcBranch.id, warehouseId: qcWh.id, priority: 0, isDefault: true },
      { branchId: qcBranch.id, warehouseId: mainWh.id, priority: 1, isDefault: false },
      // Cebu store: primary = Cebu backroom, fallback = Main DC
      { branchId: cebuBranch.id, warehouseId: cebuWh.id, priority: 0, isDefault: true },
      { branchId: cebuBranch.id, warehouseId: mainWh.id, priority: 1, isDefault: false },
    ],
  });

  await prisma.storeSetting.create({
    data: {
      currency: 'PHP',
      nextOrderSeq: 1000,
      nextPoSeq: 1000,
      defaultWarehouseId: mainWh.id,
      defaultBranchId: qcBranch.id,
    },
  });

  const bins = await Promise.all(
    [
      { warehouseId: mainWh.id, code: 'A-01', zone: 'MAIN', aisle: 'A', shelf: '01' },
      { warehouseId: mainWh.id, code: 'A-02', zone: 'MAIN', aisle: 'A', shelf: '02' },
      { warehouseId: mainWh.id, code: 'B-01', zone: 'BULK', aisle: 'B', shelf: '01' },
      { warehouseId: qcWh.id, code: 'A-01', zone: 'FLOOR', aisle: 'A', shelf: '01' },
      { warehouseId: cebuWh.id, code: 'A-01', zone: 'FLOOR', aisle: 'A', shelf: '01' },
    ].map((d) => prisma.bin.create({ data: d })),
  );

  // ── Brands ───────────────────────────────────────────────────────────────────
  console.log('brands + categories');
  const brandNames = [
    'Raspberry Pi',
    'Arduino',
    'Adafruit',
    'SparkFun',
    'Espressif',
  ];
  const brands = await Promise.all(
    brandNames.map((name) =>
      prisma.brand.create({
        data: { name, slug: name.toLowerCase().replace(/\s+/g, '-') },
      }),
    ),
  );

  // ── Categories ───────────────────────────────────────────────────────────────
  const catNames = [
    'Single Board Computers',
    'Microcontrollers',
    'Sensors',
    'Power',
    'Cables & Connectors',
    'Kits',
  ];
  const categories = await Promise.all(
    catNames.map((name, i) =>
      prisma.category.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          position: i,
        },
      }),
    ),
  );

  // ── Products + variants + images + stock ─────────────────────────────────────
  console.log('products + variants + stock');
  // 16 product blueprints. status mostly ACTIVE, a couple DRAFT/ARCHIVED.
  const productBlueprints: {
    title: string;
    slug: string;
    status: ProductStatus;
    brandIdx: number;
    catIdx: number;
    image: string;
    variants: { title: string | null; sku: string; price: number }[];
  }[] = [
    {
      title: 'Raspberry Pi 5',
      slug: 'raspberry-pi-5',
      status: 'ACTIVE',
      brandIdx: 0,
      catIdx: 0,
      image: '/products/rpi5.jpg',
      variants: [
        { title: '4GB', sku: 'RPI5-4GB', price: 3200 },
        { title: '8GB', sku: 'RPI5-8GB', price: 4500 },
      ],
    },
    {
      title: 'Raspberry Pi 4 Model B',
      slug: 'raspberry-pi-4-model-b',
      status: 'ACTIVE',
      brandIdx: 0,
      catIdx: 0,
      image: '/products/rpi5-case.jpg',
      variants: [
        { title: '2GB', sku: 'RPI4-2GB', price: 2100 },
        { title: '4GB', sku: 'RPI4-4GB', price: 2800 },
      ],
    },
    {
      title: 'Raspberry Pi Pico W',
      slug: 'raspberry-pi-pico-w',
      status: 'ACTIVE',
      brandIdx: 0,
      catIdx: 1,
      image: '/products/nano-uns.jpg',
      variants: [
        { title: 'Pre-soldered', sku: 'PICO-W-HDR', price: 420 },
        { title: 'No headers', sku: 'PICO-W', price: 350 },
      ],
    },
    {
      title: 'Arduino Uno R4 WiFi',
      slug: 'arduino-uno-r4-wifi',
      status: 'ACTIVE',
      brandIdx: 1,
      catIdx: 1,
      image: '/products/uno-ch340.jpg',
      variants: [
        { title: 'WiFi', sku: 'ARD-UNO-R4', price: 1450 },
        { title: 'Minima', sku: 'ARD-UNO-R4-M', price: 980 },
      ],
    },
    {
      title: 'Arduino Nano Every',
      slug: 'arduino-nano-every',
      status: 'ACTIVE',
      brandIdx: 1,
      catIdx: 1,
      image: '/products/nano-v3.jpg',
      variants: [
        { title: 'Single', sku: 'ARD-NANO-1', price: 720 },
        { title: '3-Pack', sku: 'ARD-NANO-3', price: 1980 },
      ],
    },
    {
      title: 'ESP32 DevKit V1',
      slug: 'esp32-devkit-v1',
      status: 'ACTIVE',
      brandIdx: 4,
      catIdx: 1,
      image: '/products/esp32.jpg',
      variants: [
        { title: 'WROOM-32', sku: 'ESP32-DEVKIT', price: 480 },
        { title: 'WROVER-IE', sku: 'ESP32-WROVER', price: 620 },
      ],
    },
    {
      title: 'ESP8266 NodeMCU',
      slug: 'esp8266-nodemcu',
      status: 'ACTIVE',
      brandIdx: 4,
      catIdx: 1,
      image: '/products/nodemcu.jpg',
      variants: [{ title: null, sku: 'ESP8266-NMCU', price: 290 }],
    },
    {
      title: 'DHT22 Temperature Sensor',
      slug: 'dht22-temperature-sensor',
      status: 'ACTIVE',
      brandIdx: 2,
      catIdx: 2,
      image: '/products/active-cooler.jpg',
      variants: [
        { title: 'Bare', sku: 'DHT22', price: 220 },
        { title: 'Module', sku: 'DHT22-MOD', price: 270 },
      ],
    },
    {
      title: 'BME280 Pressure Sensor',
      slug: 'bme280-pressure-sensor',
      status: 'ACTIVE',
      brandIdx: 2,
      catIdx: 2,
      image: '/products/mega-genuine.jpg',
      variants: [{ title: null, sku: 'BME280', price: 310 }],
    },
    {
      title: 'HC-SR04 Ultrasonic Sensor',
      slug: 'hc-sr04-ultrasonic-sensor',
      status: 'ACTIVE',
      brandIdx: 3,
      catIdx: 2,
      image: '/products/mega-ch340.jpg',
      variants: [{ title: null, sku: 'HCSR04', price: 95 }],
    },
    {
      title: '5V 3A USB-C Power Supply',
      slug: '5v-3a-usb-c-power-supply',
      status: 'ACTIVE',
      brandIdx: 0,
      catIdx: 3,
      image: '/products/rpi-psu.jpg',
      variants: [{ title: null, sku: 'PSU-USBC-5V3A', price: 540 }],
    },
    {
      title: '18650 Li-Ion Battery',
      slug: '18650-li-ion-battery',
      status: 'ACTIVE',
      brandIdx: 3,
      catIdx: 3,
      image: '/products/active-cooler.jpg',
      variants: [
        { title: '2600mAh', sku: 'BAT-18650-26', price: 180 },
        { title: '3500mAh', sku: 'BAT-18650-35', price: 250 },
      ],
    },
    {
      title: 'Jumper Wire Kit (120pc)',
      slug: 'jumper-wire-kit-120pc',
      status: 'ACTIVE',
      brandIdx: 3,
      catIdx: 4,
      image: '/products/uno-atmega.jpg',
      variants: [{ title: null, sku: 'JMP-120', price: 160 }],
    },
    {
      title: 'GPIO Ribbon Cable 40-pin',
      slug: 'gpio-ribbon-cable-40-pin',
      status: 'ACTIVE',
      brandIdx: 2,
      catIdx: 4,
      image: '/products/mega-ch340.jpg',
      variants: [{ title: null, sku: 'GPIO-RBN-40', price: 130 }],
    },
    {
      title: 'Electronics Starter Kit',
      slug: 'electronics-starter-kit',
      status: 'DRAFT',
      brandIdx: 3,
      catIdx: 5,
      image: '/products/rpi5.jpg',
      variants: [{ title: null, sku: 'KIT-START', price: 1990 }],
    },
    {
      title: 'Retro LED Matrix Panel',
      slug: 'retro-led-matrix-panel',
      status: 'ARCHIVED',
      brandIdx: 2,
      catIdx: 2,
      image: '/products/nano-v3.jpg',
      variants: [{ title: null, sku: 'LED-MTX-32', price: 760 }],
    },
  ];

  type SeededVariant = { id: string; sku: string; title: string; price: number };
  const allVariants: SeededVariant[] = [];
  let variantSeq = 0;

  for (let pi = 0; pi < productBlueprints.length; pi++) {
    const bp = productBlueprints[pi];
    const product = await prisma.product.create({
      data: {
        title: bp.title,
        slug: bp.slug,
        status: bp.status,
        brandId: brands[bp.brandIdx].id,
        description: `${bp.title} — demo catalog item.`,
        categoryLinks: {
          create: [{ categoryId: categories[bp.catIdx].id }],
        },
      },
    });

    for (let vi = 0; vi < bp.variants.length; vi++) {
      const v = bp.variants[vi];
      const variant = await prisma.variant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          title: v.title,
          price: money(v.price),
          compareAtPrice:
            vi === 0 ? money(Math.round(v.price * 1.15)) : undefined,
          position: vi,
        },
      });

      // Image (primary on first variant of product).
      await prisma.productImage.create({
        data: {
          productId: product.id,
          variantId: variant.id,
          url: bp.image,
          alt: `${bp.title} ${v.title ?? ''}`.trim(),
          position: vi,
          isPrimary: vi === 0,
        },
      });

      // Stock buckets: vary across healthy / low / out.
      // Deterministic-ish by global variant index.
      const reorderPoint = 20;
      let onHand: number;
      let reserved: number;
      const bucket = variantSeq % 7;
      if (bucket === 3) {
        // OUT
        onHand = 0;
        reserved = 0;
      } else if (bucket === 5 || bucket === 6) {
        // LOW: available <= reorderPoint
        onHand = 8 + (variantSeq % 6); // 8..13
        reserved = Math.min(onHand, 2 + (variantSeq % 3));
      } else {
        // HEALTHY
        onHand = 60 + ((variantSeq * 37) % 340); // 60..399
        reserved = (variantSeq * 3) % 12;
      }
      const incoming = bucket % 2 === 0 ? (variantSeq % 4) * 25 : 0;

      const variantStock = await prisma.stockItem.create({
        data: {
          kind: 'VARIANT',
          variantId: variant.id,
          unitOfMeasure: 'EACH',
          onHand: money(onHand),
          reserved: money(reserved),
          incoming: money(incoming),
          reorderPoint: money(reorderPoint),
          reorderQty: money(100),
        },
      });
      // distribute across warehouses (Σ WarehouseStockItem == StockItem rollup)
      await seedWarehouseStock(
        variantStock.id,
        { onHand, reserved, incoming },
        mainWh.id,
        qcWh.id,
      );

      allVariants.push({
        id: variant.id,
        sku: v.sku,
        title: [bp.title, v.title].filter(Boolean).join(' '),
        price: v.price,
      });
      variantSeq++;
    }
  }
  console.log(`  ${allVariants.length} variants seeded`);

  // ── Raw materials + stock (some low) ─────────────────────────────────────────
  console.log('raw materials');
  const rawMaterials = [
    { name: '10k Resistor', sku: 'RM-R10K', uom: 'EACH', onHand: 4200, rp: 500 },
    { name: '0.1uF Capacitor', sku: 'RM-CAP01', uom: 'EACH', onHand: 80, rp: 300 }, // LOW
    { name: 'Solder Wire 0.8mm', sku: 'RM-SOLDER', uom: 'METER', onHand: 12, rp: 25 }, // LOW
    { name: 'PCB Blank 5x7cm', sku: 'RM-PCB57', uom: 'EACH', onHand: 600, rp: 100 },
    { name: 'Header Pins 40p', sku: 'RM-HDR40', uom: 'EACH', onHand: 1500, rp: 200 },
  ] as const;
  for (let i = 0; i < rawMaterials.length; i++) {
    const rm = rawMaterials[i];
    const created = await prisma.rawMaterial.create({
      data: {
        name: rm.name,
        sku: rm.sku,
        defaultUnit: rm.uom,
      },
    });
    const matStockItem = await prisma.stockItem.create({
      data: {
        kind: 'MATERIAL',
        rawMaterialId: created.id,
        unitOfMeasure: rm.uom,
        onHand: money(rm.onHand),
        reserved: money(0),
        incoming: money(0),
        reorderPoint: money(rm.rp),
        reorderQty: money(rm.rp * 4),
      },
    });
    // raw materials live mostly in the Main DC
    await seedWarehouseStock(
      matStockItem.id,
      { onHand: rm.onHand, reserved: 0, incoming: 0 },
      mainWh.id,
      qcWh.id,
    );
  }

  // ── Customers (role CUSTOMER) spread across last 90 days ──────────────────────
  console.log('customers');
  const customerData = [
    ['Maria', 'Santos'],
    ['Juan', 'Dela Cruz'],
    ['Andrea', 'Reyes'],
    ['Miguel', 'Garcia'],
    ['Sofia', 'Ramos'],
    ['Carlo', 'Mendoza'],
    ['Bea', 'Aquino'],
    ['Paolo', 'Villanueva'],
    ['Isabella', 'Torres'],
    ['Diego', 'Castillo'],
    ['Nicole', 'Flores'],
    ['Rafael', 'Gonzales'],
  ];
  const customers: { id: string; email: string }[] = [];
  for (let i = 0; i < customerData.length; i++) {
    const [firstName, lastName] = customerData[i];
    const email = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/\s+/g, '')
      .concat('@example.com');
    const createdAt = daysAgo(88 - i * 7); // spread 1..88 days back
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'demo-not-a-real-hash',
        role: 'CUSTOMER',
        firstName,
        lastName,
        createdAt,
        updatedAt: createdAt,
      },
    });
    customers.push({ id: user.id, email });
  }

  // ── Orders (~150) spread across last ~90 days ────────────────────────────────
  console.log('orders (~150)');
  const orderStatuses: OrderStatus[] = [
    'COMPLETED',
    'FULFILLED',
    'COMPLETED',
    'FULFILLED',
    'CONFIRMED',
    'PENDING',
    'PARTIALLY_FULFILLED',
    'CANCELLED',
    'REFUNDED',
    'COMPLETED',
  ];

  const ORDER_COUNT = 150;
  const variantCount = allVariants.length;
  for (let i = 0; i < ORDER_COUNT; i++) {
    // Bias toward the recent window so deltas are non-trivial but both windows
    // have volume. Days 0..89.
    const dayOffset = (i * 89) % 90; // 0..89 spread, deterministic
    const placedAt = daysAgo(dayOffset);
    const customer = pick(customers, i);
    const status = pick(orderStatuses, i);

    // 1..4 lines referencing real variants
    const lineCount = 1 + (i % 4);
    const lines: {
      variantId: string;
      sku: string;
      title: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }[] = [];
    let subtotal = 0;
    for (let l = 0; l < lineCount; l++) {
      const v = allVariants[(i * 3 + l * 7) % variantCount];
      const quantity = 1 + ((i + l) % 3); // 1..3
      const lineTotal = v.price * quantity;
      subtotal += lineTotal;
      lines.push({
        variantId: v.id,
        sku: v.sku,
        title: v.title,
        quantity,
        unitPrice: money(v.price),
        lineTotal: money(lineTotal),
      });
    }
    const shipping = 75;
    const grandTotal = subtotal + shipping;

    // ~1 in 5 orders are in-store (POS) at a branch; the rest are WEB.
    const isPos = i % 5 === 0;
    const channel: SalesChannel = isPos ? 'POS' : 'WEB';
    const branchId = isPos ? pick(branches, i).id : null;

    await prisma.order.create({
      data: {
        orderNumber: `CR-${1000 + i}`,
        userId: customer.id,
        email: customer.email,
        status,
        channel,
        branchId,
        currency: 'PHP',
        subtotal: money(subtotal),
        shippingTotal: money(shipping),
        grandTotal: money(grandTotal),
        placedAt,
        createdAt: placedAt,
        updatedAt: placedAt,
        confirmedAt:
          status === 'PENDING' || status === 'CANCELLED' ? null : placedAt,
        cancelledAt: status === 'CANCELLED' ? placedAt : null,
        shipName: 'Demo Recipient',
        shipLine1: '123 Demo St',
        shipCity: 'Manila',
        shipRegion: 'NCR',
        shipPostal: '1000',
        shipCountry: 'PH',
        lines: { create: lines },
      },
    });
  }

  // ── Vendor + purchase orders (varied, some open) ─────────────────────────────
  console.log('vendor + purchase orders');
  const vendor = await prisma.vendor.create({
    data: {
      name: 'Shenzhen Parts Co',
      code: 'V-SZPARTS',
      email: 'sales@szparts.example.com',
      leadTimeDays: 14,
    },
  });
  // grab a few stock items to reference on PO lines
  const someStock = await prisma.stockItem.findMany({
    take: 4,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const poStatuses: POStatus[] = ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED'];
  for (let i = 0; i < poStatuses.length; i++) {
    const stockId = someStock[i % someStock.length].id;
    const qty = 100 + i * 50;
    const unitCost = 12.5 + i;
    const lineTotal = qty * unitCost;
    await prisma.purchaseOrder.create({
      data: {
        vendorId: vendor.id,
        destinationWarehouseId: mainWh.id,
        poNumber: `PO-${2000 + i}`,
        status: poStatuses[i],
        currency: 'PHP',
        expectedDate: daysAgo(-7 - i), // future-ish
        subtotal: money(lineTotal),
        total: money(lineTotal),
        createdAt: daysAgo(20 - i * 3),
        updatedAt: daysAgo(20 - i * 3),
        lines: {
          create: [
            {
              stockItemId: stockId,
              description: 'Restock components',
              qtyOrdered: money(qty),
              unitCost: money(unitCost),
              lineTotal: money(lineTotal),
            },
          ],
        },
      },
    });
  }

  // ── Build orders (varied, some open) ─────────────────────────────────────────
  console.log('build orders');
  // Need a BOM per build order's variant. Use the first material's stock item
  // as a generic BOM input.
  const matStock = await prisma.stockItem.findFirst({
    where: { kind: 'MATERIAL' },
    select: { id: true },
  });
  const buildStatuses: BuildStatus[] = [
    'DRAFT',
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  for (let i = 0; i < buildStatuses.length; i++) {
    const variant = allVariants[i % variantCount];
    const bom = await prisma.billOfMaterials.create({
      data: {
        variantId: variant.id,
        version: 100 + i, // avoid unique [variantId, version] collisions
        lines: matStock
          ? {
              create: [
                { stockItemId: matStock.id, quantity: money(2), unit: 'EACH' },
              ],
            }
          : undefined,
      },
    });
    const status = buildStatuses[i];
    await prisma.buildOrder.create({
      data: {
        variantId: variant.id,
        bomId: bom.id,
        warehouseId: mainWh.id,
        status,
        qtyPlanned: money(10 + i * 5),
        qtyProduced: status === 'COMPLETED' ? money(10 + i * 5) : money(0),
        startedAt: status === 'DRAFT' || status === 'PLANNED' ? null : daysAgo(5),
        completedAt: status === 'COMPLETED' ? daysAgo(2) : null,
        createdAt: daysAgo(10 - i),
        updatedAt: daysAgo(10 - i),
      },
    });
  }

  // ── Fulfillments (PENDING) + return requests ─────────────────────────────────
  console.log('fulfillments + returns');
  const recentOrders = await prisma.order.findMany({
    take: 4,
    orderBy: { placedAt: 'desc' },
    select: { id: true },
  });
  for (let i = 0; i < 2 && i < recentOrders.length; i++) {
    await prisma.fulfillment.create({
      data: {
        orderId: recentOrders[i].id,
        warehouseId: mainWh.id,
        status: 'PENDING',
        createdAt: daysAgo(i),
        updatedAt: daysAgo(i),
      },
    });
  }
  for (let i = 2; i < 4 && i < recentOrders.length; i++) {
    await prisma.returnRequest.create({
      data: {
        orderId: recentOrders[i].id,
        status: 'REQUESTED',
        reason: 'Customer changed mind',
        createdAt: daysAgo(i),
        updatedAt: daysAgo(i),
      },
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const [pCount, vCount, oCount, uCount] = await Promise.all([
    prisma.product.count(),
    prisma.variant.count(),
    prisma.order.count(),
    prisma.user.count(),
  ]);
  console.log(
    `\nDEMO SEED OK — products=${pCount} variants=${vCount} orders=${oCount} customers=${uCount}`,
  );
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
