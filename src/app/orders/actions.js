// actions.js
"use server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ---------- YENİ FONKSİYONLAR ve DİĞER İŞLEMLER ---------- */
export async function getRegionTablesAndSessions(regionId) {
  const tables = await prisma.table.findMany({
    where: { regionId },
    orderBy: { tableId: "asc" },
  });

  const tableIds = tables.map((t) => t.id);

  const sessions = await prisma.tableSession.findMany({
    where: {
      tableId: { in: tableIds },
      status: "open",
    },
    include: { items: true },
  });

  const sessionMap = {};
  for (const s of sessions) {
    sessionMap[s.tableId] = s;
  }

  return { tables, sessionMap };
}

export async function getRegions() {
  return await prisma.region.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createRegion(name) {
  return await prisma.region.create({ data: { name } });
}

export async function getTablesByRegion(regionId) {
  return await prisma.table.findMany({
    where: { regionId },
    orderBy: { tableId: "asc" },
  });
}

export async function getAllTables() {
  return await prisma.table.findMany({
    orderBy: { tableId: "asc" },
    include: { region: true },
  });
}

export async function addTable(regionId) {
  const region = await prisma.region.findUnique({ where: { id: regionId } });
  if (!region) throw new Error("Bölge bulunamadı!");

  const tablesInRegion = await prisma.table.findMany({
    where: { regionId },
    orderBy: { tableId: "asc" },
  });
  let nextId = 1;
  if (tablesInRegion.length > 0) {
    nextId = tablesInRegion[tablesInRegion.length - 1].tableId + 1;
  }

  return await prisma.table.create({
    data: {
      tableId: nextId,
      regionId,
    },
  });
}

export async function deleteTable(tableDbId) {
  return await prisma.table.delete({
    where: { id: tableDbId },
  });
}

export async function openTable(regionId, numericTableId) {
  const tableData = await prisma.table.findFirst({
    where: { regionId, tableId: numericTableId },
  });
  if (!tableData) {
    throw new Error(
      `Bölgede (regionId=${regionId}) tableId=${numericTableId} bulunamadı!`
    );
  }

  let session = await prisma.tableSession.findFirst({
    where: {
      tableId: tableData.id,
      status: "open",
    },
    include: { items: true },
  });

  if (!session) {
    session = await prisma.tableSession.create({
      data: {
        tableId: tableData.id,
        status: "open",
        total: 0,
      },
      include: { items: true },
    });
  }
  return session;
}

export async function getOpenSession(regionId, numericTableId) {
  const tableData = await prisma.table.findFirst({
    where: { regionId, tableId: numericTableId },
  });
  if (!tableData) return null;

  return await prisma.tableSession.findFirst({
    where: {
      tableId: tableData.id,
      status: "open",
    },
    include: { items: true },
  });
}

export async function upsertOrderItems(tableSessionId, items) {
  for (const i of items) {
    if (i.quantity === 0) {
      await prisma.tableSessionItem.deleteMany({
        where: { tableSessionId, name: i.name },
      });
    } else {
      await prisma.tableSessionItem.upsert({
        where: {
          tableSessionId_name: {
            tableSessionId,
            name: i.name,
          },
        },
        update: {
          quantity: i.quantity,
          price: i.price,
        },
        create: {
          tableSessionId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        },
      });
    }
  }

  const allItems = await prisma.tableSessionItem.findMany({
    where: { tableSessionId },
  });
  const total = allItems.reduce((acc, cur) => acc + cur.price * cur.quantity, 0);

  return await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: { total },
    include: { items: true },
  });
}

export async function upsertOrderItemsBulk(tableSessionId, items) {
  await prisma.tableSessionItem.deleteMany({
    where: { tableSessionId },
  });

  await prisma.tableSessionItem.createMany({
    data: items.map((it) => ({
      tableSessionId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
    })),
  });

  const allItems = await prisma.tableSessionItem.findMany({
    where: { tableSessionId },
  });
  const total = allItems.reduce((acc, cur) => acc + cur.price * cur.quantity, 0);

  return await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: { total },
    include: { items: true },
  });
}

export async function payTable(sessionId, paymentMethod) {
  const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found!");
  if (session.status !== "open") throw new Error("Session not open!");

  // Burada artık socket yayın yok, sadece DB güncellemesi
  const updatedSession = await prisma.tableSession.update({
    where: { id: sessionId },
    data: {
      status: "paid",
      paymentMethod,
      closedAt: new Date(),
    },
  });

  return updatedSession;
}

export async function cancelTable(sessionId) {
  const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found!");
  if (session.status !== "open") throw new Error("Session not open!");

  // Burada da socket yayın yok
  const updatedSession = await prisma.tableSession.update({
    where: { id: sessionId },
    data: {
      status: "canceled",
      closedAt: new Date(),
    },
  });

  return updatedSession;
}

export async function getCanceledSessions() {
  return await prisma.tableSession.findMany({
    where: { status: "canceled" },
    orderBy: { closedAt: "desc" },
    include: { items: true },
  });
}

export async function getPaidSessions() {
  return await prisma.tableSession.findMany({
    where: { status: "paid" },
    orderBy: { closedAt: "desc" },
    include: { items: true },
  });
}

export async function getProducts() {
  return await prisma.product.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createProduct(name, price) {
  return await prisma.product.create({
    data: { name, price },
  });
}

export async function deleteProduct(productId) {
  return await prisma.product.delete({
    where: { id: productId },
  });
}
