/**
 * Round-trip smoke seed for circuit.rocks (MULTI-WAREHOUSE + MULTI-BRANCH).
 * Exercises: receive (PO->GRN->Lot @WH), build (consume->produce @WH),
 * transfer (ship->receive between warehouses), sell (reserve->ship from a branch's WH),
 * return (restock @WH). Asserts the ledger reconciles PER (stockItem, warehouse) AND
 * that StockItem rollups == Σ WarehouseStockItem. Run: `pnpm prisma db seed`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Tx = Prisma.TransactionClient;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok: ${msg}`);
}

const PHYSICAL_REASONS = [
  'RECEIPT',
  'SALE',
  'BUILD_CONSUME',
  'BUILD_PRODUCE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ADJUST',
  'RETURN',
  'SCRAP',
] as const;

// Sum the immutable ledger for a (stockItem, warehouse) -> should equal WHSI.onHand.
async function ledgerOnHand(stockItemId: string, warehouseId: string): Promise<number> {
  const rows = await prisma.stockMovement.findMany({
    where: { stockItemId, warehouseId, reason: { in: [...PHYSICAL_REASONS] } },
    select: { qtyDelta: true },
  });
  return rows.reduce((s, r) => s + Number(r.qtyDelta), 0);
}

async function whsiOnHand(stockItemId: string, warehouseId: string): Promise<number> {
  const r = await prisma.warehouseStockItem.findUnique({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
  });
  return r ? Number(r.onHand) : 0;
}

async function rollupOnHand(stockItemId: string): Promise<number> {
  const agg = await prisma.warehouseStockItem.aggregate({
    where: { stockItemId },
    _sum: { onHand: true },
  });
  return Number(agg._sum.onHand ?? 0);
}

function incData(d: { onHand?: number; reserved?: number; incoming?: number }) {
  const out: Record<string, { increment: number }> = {};
  if (d.onHand !== undefined) out.onHand = { increment: d.onHand };
  if (d.reserved !== undefined) out.reserved = { increment: d.reserved };
  if (d.incoming !== undefined) out.incoming = { increment: d.incoming };
  return out;
}

// Bump a per-warehouse bucket AND the StockItem rollup by the same deltas (one txn).
async function bump(
  tx: Tx,
  stockItemId: string,
  warehouseId: string,
  d: { onHand?: number; reserved?: number; incoming?: number },
) {
  await tx.warehouseStockItem.upsert({
    where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
    create: { stockItemId, warehouseId, ...flatten(d) },
    update: incData(d),
  });
  await tx.stockItem.update({ where: { id: stockItemId }, data: incData(d) });
}

function flatten(d: { onHand?: number; reserved?: number; incoming?: number }) {
  return {
    onHand: d.onHand ?? 0,
    reserved: d.reserved ?? 0,
    incoming: d.incoming ?? 0,
  };
}

async function main() {
  console.log('settings + warehouses + branch');
  await prisma.storeSetting.create({ data: { currency: 'PHP' } });

  const main = await prisma.warehouse.create({
    data: { name: 'Main DC', code: 'WH-MAIN', type: 'DISTRIBUTION', isDefaultWeb: true, city: 'Manila' },
  });
  const branchWh = await prisma.warehouse.create({
    data: { name: 'Quezon City Backroom', code: 'WH-QC', type: 'RETAIL_BACKROOM', city: 'Quezon City' },
  });
  const branch = await prisma.branch.create({
    data: { name: 'QC Store', code: 'BR-QC', city: 'Quezon City' },
  });
  await prisma.branchWarehouse.createMany({
    data: [
      { branchId: branch.id, warehouseId: branchWh.id, priority: 0, isDefault: true },
      { branchId: branch.id, warehouseId: main.id, priority: 1, isDefault: false },
    ],
  });
  const binMain = await prisma.bin.create({ data: { warehouseId: main.id, code: 'A-01', zone: 'MAIN' } });
  const binQc = await prisma.bin.create({ data: { warehouseId: branchWh.id, code: 'A-01', zone: 'FLOOR' } });

  // ── raw material + its stock item ──────────────────────────────────────────
  console.log('raw material');
  const resistor = await prisma.rawMaterial.create({ data: { name: '10k Resistor', sku: 'RM-R10K' } });
  const rmStock = await prisma.stockItem.create({
    data: { kind: 'MATERIAL', rawMaterialId: resistor.id, unitOfMeasure: 'EACH', reorderPoint: 100, reorderQty: 1000 },
  });

  // ── vendor + catalog ────────────────────────────────────────────────────────
  console.log('vendor + PO (-> Main DC)');
  const vendor = await prisma.vendor.create({ data: { name: 'Parts Co', code: 'V-PARTS' } });
  await prisma.vendorItem.create({
    data: { vendorId: vendor.id, stockItemId: rmStock.id, unitCost: '0.5000', moq: 500 },
  });

  // ── purchase order (incoming +500 into Main DC) ──────────────────────────────
  const po = await prisma.purchaseOrder.create({
    data: {
      vendorId: vendor.id, destinationWarehouseId: main.id, poNumber: 'PO-1001', status: 'SENT',
      subtotal: '250.00', total: '250.00',
      lines: { create: [{ stockItemId: rmStock.id, description: '10k Resistor', qtyOrdered: 500, unitCost: '0.5000', lineTotal: '250.00' }] },
    },
    include: { lines: true },
  });
  await prisma.$transaction((tx) => bump(tx, rmStock.id, main.id, { incoming: 500 }));

  // ── goods receipt @ Main DC: lot, level, RECEIPT movement, buckets ───────────
  console.log('goods receipt -> lot @ Main DC');
  const poLine = po.lines[0];
  await prisma.$transaction(async (tx) => {
    const receipt = await tx.goodsReceipt.create({ data: { purchaseOrderId: po.id, warehouseId: main.id } });
    const rl = await tx.goodsReceiptLine.create({
      data: { goodsReceiptId: receipt.id, purchaseOrderLineId: poLine.id, stockItemId: rmStock.id, qtyReceived: 500, unitCost: '0.5000', binId: binMain.id, lotCode: 'L-RM-1' },
    });
    const lot = await tx.lot.create({
      data: { stockItemId: rmStock.id, warehouseId: main.id, code: 'L-RM-1', unitCost: '0.5000', qtyReceived: 500, qtyRemaining: 500, receiptLineId: rl.id },
    });
    await tx.stockLevel.create({ data: { stockItemId: rmStock.id, warehouseId: main.id, lotId: lot.id, binId: binMain.id, onHand: 500 } });
    await tx.stockMovement.create({
      data: { stockItemId: rmStock.id, warehouseId: main.id, lotId: lot.id, binId: binMain.id, qtyDelta: 500, reason: 'RECEIPT', refType: 'PURCHASE_RECEIPT', refId: rl.id, unitCostAtMove: '0.5000' },
    });
    await bump(tx, rmStock.id, main.id, { onHand: 500, incoming: -500 });
    await tx.purchaseOrderLine.update({ where: { id: poLine.id }, data: { qtyReceived: 500 } });
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED' } });
  });

  assert((await whsiOnHand(rmStock.id, main.id)) === 500, 'rm @Main onHand=500 after receipt');
  assert((await ledgerOnHand(rmStock.id, main.id)) === 500, 'rm @Main ledger reconciles to 500');
  assert((await rollupOnHand(rmStock.id)) === 500, 'rm rollup=500');

  // ── built product (a kit) + its stock item + BOM (needs 2 resistors) ─────────
  console.log('product + variant (BUILT) + BOM');
  const product = await prisma.product.create({ data: { title: 'Starter Kit', slug: 'starter-kit', status: 'ACTIVE' } });
  const variant = await prisma.variant.create({
    data: { productId: product.id, sku: 'KIT-001', sourcingType: 'BUILT', price: '499.00' },
  });
  const kitStock = await prisma.stockItem.create({ data: { kind: 'VARIANT', variantId: variant.id } });
  const bom = await prisma.billOfMaterials.create({
    data: { variantId: variant.id, lines: { create: [{ stockItemId: rmStock.id, quantity: 2, unit: 'EACH' }] } },
  });

  // ── build order @ Main DC: consume 20 resistors, produce 10 kits @ 1.00 ──────
  console.log('build order: consume -> produce @ Main DC');
  await prisma.$transaction(async (tx) => {
    const bo = await tx.buildOrder.create({ data: { variantId: variant.id, bomId: bom.id, warehouseId: main.id, status: 'IN_PROGRESS', qtyPlanned: 10 } });
    const rmLot = await tx.lot.findFirstOrThrow({ where: { stockItemId: rmStock.id, warehouseId: main.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
    await tx.buildConsumption.create({ data: { buildOrderId: bo.id, stockItemId: rmStock.id, warehouseId: main.id, lotId: rmLot.id, binId: binMain.id, quantity: 20, unitCostAtConsume: '0.5000' } });
    await tx.stockMovement.create({ data: { stockItemId: rmStock.id, warehouseId: main.id, lotId: rmLot.id, binId: binMain.id, qtyDelta: -20, reason: 'BUILD_CONSUME', refType: 'BUILD_ORDER', refId: bo.id, unitCostAtMove: '0.5000' } });
    await tx.stockLevel.updateMany({ where: { stockItemId: rmStock.id, warehouseId: main.id, lotId: rmLot.id, binId: binMain.id }, data: { onHand: { decrement: 20 } } });
    await tx.lot.update({ where: { id: rmLot.id }, data: { qtyRemaining: { decrement: 20 } } });
    await bump(tx, rmStock.id, main.id, { onHand: -20 });
    // produce 10 finished kits -> new finished-good lot @ Main, cost = 20*0.5/10 = 1.00
    const kitLot = await tx.lot.create({ data: { stockItemId: kitStock.id, warehouseId: main.id, code: 'L-KIT-1', unitCost: '1.0000', qtyReceived: 10, qtyRemaining: 10 } });
    await tx.buildOutput.create({ data: { buildOrderId: bo.id, stockItemId: kitStock.id, warehouseId: main.id, lotId: kitLot.id, binId: binMain.id, quantity: 10, computedUnitCost: '1.0000' } });
    await tx.stockLevel.create({ data: { stockItemId: kitStock.id, warehouseId: main.id, lotId: kitLot.id, binId: binMain.id, onHand: 10 } });
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: main.id, lotId: kitLot.id, binId: binMain.id, qtyDelta: 10, reason: 'BUILD_PRODUCE', refType: 'BUILD_ORDER', refId: bo.id, unitCostAtMove: '1.0000' } });
    await bump(tx, kitStock.id, main.id, { onHand: 10 });
    await tx.buildOrder.update({ where: { id: bo.id }, data: { status: 'COMPLETED', qtyProduced: 10, completedAt: new Date() } });
  });

  assert((await whsiOnHand(rmStock.id, main.id)) === 480, 'rm @Main onHand=480 after consume');
  assert((await whsiOnHand(kitStock.id, main.id)) === 10, 'kit @Main onHand=10 after produce');
  assert((await ledgerOnHand(kitStock.id, main.id)) === 10, 'kit @Main ledger reconciles to 10');

  // ── transfer 4 kits Main DC -> QC backroom (ship then receive) ───────────────
  console.log('stock transfer: Main DC -> QC backroom (4 kits)');
  const transfer = await prisma.stockTransfer.create({
    data: {
      transferNumber: 'TR-1001', sourceWarehouseId: main.id, destWarehouseId: branchWh.id, status: 'DRAFT',
      lines: { create: [{ stockItemId: kitStock.id, quantity: 4 }] },
    },
    include: { lines: true },
  });
  const trLine = transfer.lines[0];
  // ship: TRANSFER_OUT @ source, dest incoming +
  await prisma.$transaction(async (tx) => {
    const srcLot = await tx.lot.findFirstOrThrow({ where: { stockItemId: kitStock.id, warehouseId: main.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: main.id, lotId: srcLot.id, binId: binMain.id, qtyDelta: -4, reason: 'TRANSFER_OUT', refType: 'STOCK_TRANSFER', refId: transfer.id, unitCostAtMove: '1.0000' } });
    await tx.stockLevel.updateMany({ where: { stockItemId: kitStock.id, warehouseId: main.id, lotId: srcLot.id, binId: binMain.id }, data: { onHand: { decrement: 4 } } });
    await tx.lot.update({ where: { id: srcLot.id }, data: { qtyRemaining: { decrement: 4 } } });
    await bump(tx, kitStock.id, main.id, { onHand: -4 });
    await bump(tx, kitStock.id, branchWh.id, { incoming: 4 });
    await tx.stockTransferLine.update({ where: { id: trLine.id }, data: { qtyShipped: 4, sourceLotId: srcLot.id, sourceBinId: binMain.id } });
    await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: 'IN_TRANSIT', shippedAt: new Date() } });
  });
  // receive: TRANSFER_IN @ dest, new dest lot (cost lineage)
  await prisma.$transaction(async (tx) => {
    const trl = await tx.stockTransferLine.findUniqueOrThrow({ where: { id: trLine.id } });
    const destLot = await tx.lot.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, code: 'L-KIT-1-QC', unitCost: '1.0000', qtyReceived: 4, qtyRemaining: 4, sourceLotId: trl.sourceLotId } });
    await tx.stockLevel.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: destLot.id, binId: binQc.id, onHand: 4 } });
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: destLot.id, binId: binQc.id, qtyDelta: 4, reason: 'TRANSFER_IN', refType: 'STOCK_TRANSFER', refId: transfer.id, unitCostAtMove: '1.0000' } });
    await bump(tx, kitStock.id, branchWh.id, { onHand: 4, incoming: -4 });
    await tx.stockTransferLine.update({ where: { id: trLine.id }, data: { qtyReceived: 4, destBinId: binQc.id } });
    await tx.stockTransfer.update({ where: { id: transfer.id }, data: { status: 'RECEIVED', receivedAt: new Date() } });
  });

  assert((await whsiOnHand(kitStock.id, main.id)) === 6, 'kit @Main onHand=6 after transfer out');
  assert((await whsiOnHand(kitStock.id, branchWh.id)) === 4, 'kit @QC onHand=4 after transfer in');
  assert((await ledgerOnHand(kitStock.id, main.id)) === 6, 'kit @Main ledger=6 (10 -4)');
  assert((await ledgerOnHand(kitStock.id, branchWh.id)) === 4, 'kit @QC ledger=4 (+4)');
  assert((await rollupOnHand(kitStock.id)) === 10, 'kit rollup=10 after transfer (mass conserved)');

  // ── order from QC branch (POS): reserve 3 @ QC -> ship 3 @ QC ────────────────
  console.log('order @ QC branch (POS): reserve -> ship');
  const order = await prisma.order.create({
    data: {
      orderNumber: 'SO-1001', email: 'buyer@example.com', status: 'PENDING', channel: 'POS', branchId: branch.id,
      subtotal: '1497.00', grandTotal: '1497.00',
      shipName: 'Buyer', shipLine1: '1 St', shipCity: 'Quezon City', shipRegion: 'NCR', shipPostal: '1100', shipCountry: 'PH',
      lines: { create: [{ variantId: variant.id, sku: 'KIT-001', title: 'Starter Kit', quantity: 3, unitPrice: '499.00', lineTotal: '1497.00' }] },
    },
    include: { lines: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, qtyDelta: 0, reason: 'RESERVE', refType: 'ORDER', refId: order.id, note: 'reserve 3 @QC' } });
    await bump(tx, kitStock.id, branchWh.id, { reserved: 3 });
  });
  const whsiQc = await prisma.warehouseStockItem.findUniqueOrThrow({ where: { stockItemId_warehouseId: { stockItemId: kitStock.id, warehouseId: branchWh.id } } });
  assert(Number(whsiQc.onHand) - Number(whsiQc.reserved) === 1, 'kit @QC available=1 after reserve 3');

  await prisma.$transaction(async (tx) => {
    const kitLot = await tx.lot.findFirstOrThrow({ where: { stockItemId: kitStock.id, warehouseId: branchWh.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
    const ful = await tx.fulfillment.create({ data: { orderId: order.id, warehouseId: branchWh.id, status: 'SHIPPED', carrier: 'Pickup', shippedAt: new Date() } });
    await tx.fulfillmentLine.create({ data: { fulfillmentId: ful.id, orderLineId: order.lines[0].id, stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: kitLot.id, binId: binQc.id, quantity: 3 } });
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: kitLot.id, binId: binQc.id, qtyDelta: -3, reason: 'SALE', refType: 'FULFILLMENT', refId: ful.id, unitCostAtMove: '1.0000' } });
    await tx.stockLevel.updateMany({ where: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: kitLot.id, binId: binQc.id }, data: { onHand: { decrement: 3 } } });
    await tx.lot.update({ where: { id: kitLot.id }, data: { qtyRemaining: { decrement: 3 } } });
    await bump(tx, kitStock.id, branchWh.id, { onHand: -3, reserved: -3 });
    await tx.orderLine.update({ where: { id: order.lines[0].id }, data: { qtyFulfilled: 3 } });
    await tx.order.update({ where: { id: order.id }, data: { status: 'FULFILLED', confirmedAt: new Date() } });
  });
  assert((await whsiOnHand(kitStock.id, branchWh.id)) === 1, 'kit @QC onHand=1 after ship');
  assert((await rollupOnHand(kitStock.id)) === 7, 'kit rollup=7 after ship (6 +1)');

  // ── return: restock 1 kit @ QC ───────────────────────────────────────────────
  console.log('return: restock @ QC');
  await prisma.$transaction(async (tx) => {
    const kitLot = await tx.lot.findFirstOrThrow({ where: { stockItemId: kitStock.id, warehouseId: branchWh.id }, orderBy: { createdAt: 'asc' } });
    const rr = await tx.returnRequest.create({ data: { orderId: order.id, status: 'RECEIVED', receivedAt: new Date() } });
    await tx.returnLine.create({ data: { returnRequestId: rr.id, orderLineId: order.lines[0].id, quantity: 1, condition: 'RESELLABLE', restock: true, restockWarehouseId: branchWh.id, restockBinId: binQc.id, restockLotId: kitLot.id } });
    await tx.stockMovement.create({ data: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: kitLot.id, binId: binQc.id, qtyDelta: 1, reason: 'RETURN', refType: 'RETURN', refId: rr.id, unitCostAtMove: '1.0000' } });
    await tx.stockLevel.updateMany({ where: { stockItemId: kitStock.id, warehouseId: branchWh.id, lotId: kitLot.id, binId: binQc.id }, data: { onHand: { increment: 1 } } });
    await tx.lot.update({ where: { id: kitLot.id }, data: { qtyRemaining: { increment: 1 } } });
    await bump(tx, kitStock.id, branchWh.id, { onHand: 1 });
    await tx.orderLine.update({ where: { id: order.lines[0].id }, data: { qtyReturned: 1 } });
  });
  assert((await whsiOnHand(kitStock.id, branchWh.id)) === 2, 'kit @QC onHand=2 after return restock');
  assert((await ledgerOnHand(kitStock.id, branchWh.id)) === 2, 'kit @QC ledger=2 (+4 -3 +1)');
  assert((await rollupOnHand(kitStock.id)) === 8, 'kit rollup=8 (6 +2)');

  // ── final rollup reconciliation: StockItem.onHand == Σ WarehouseStockItem ─────
  const kitStockItem = await prisma.stockItem.findUniqueOrThrow({ where: { id: kitStock.id } });
  assert(Number(kitStockItem.onHand) === (await rollupOnHand(kitStock.id)), 'StockItem.onHand == Σ WarehouseStockItem (kit)');
  const rmStockItem = await prisma.stockItem.findUniqueOrThrow({ where: { id: rmStock.id } });
  assert(Number(rmStockItem.onHand) === (await rollupOnHand(rmStock.id)), 'StockItem.onHand == Σ WarehouseStockItem (rm)');

  console.log('\nSMOKE OK — per-warehouse ledger + rollups reconciled (incl. transfer).');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
