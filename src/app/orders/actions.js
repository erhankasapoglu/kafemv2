// actions.js
"use server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ---------- MASA/SIPARIŞ İŞLEMLERİ ---------- */
export async function getRegionTablesAndSessions(regionId) {
  const tables = await prisma.table.findMany({
    where: { regionId },
    orderBy: { tableId: "asc" },
  });
  const tableIds = tables.map((t) => t.id);

  const sessions = await prisma.tableSession.findMany({
    where: { tableId: { in: tableIds }, status: "open" },
    include: { items: true },
  });

  const sessionMap = {};
  for (const s of sessions) {
    sessionMap[s.tableId] = s;
  }
  return { tables, sessionMap };
}

export async function getRegions() {
  return await prisma.region.findMany({ orderBy: { name: "asc" } });
}

export async function createRegion(name) {
  return await prisma.region.create({ data: { name } });
}

// Yeni eklenen fonksiyon: Bölge silme
export async function deleteRegion(regionId) {
  return await prisma.region.delete({ where: { id: regionId } });
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
    data: { tableId: nextId, regionId },
  });
}

export async function deleteTable(tableDbId) {
  return await prisma.table.delete({ where: { id: tableDbId } });
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
    where: { tableId: tableData.id, status: "open" },
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
    where: { tableId: tableData.id, status: "open" },
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
          tableSessionId_name: { tableSessionId, name: i.name },
        },
        update: { quantity: i.quantity, price: i.price },
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
  await prisma.tableSessionItem.deleteMany({ where: { tableSessionId } });
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

  const updatedSession = await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: "paid", paymentMethod, closedAt: new Date() },
  });
  return updatedSession;
}

export async function cancelTable(sessionId) {
  const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found!");
  if (session.status !== "open") throw new Error("Session not open!");

  const updatedSession = await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: "canceled", closedAt: new Date() },
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

/* ---------- ÜRÜN VE KATEGORİ İŞLEMLERİ ---------- */
export async function getProducts() {
  return await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { category: true },
  });
}

export async function createProduct(name, price, categoryId = null, isFavorite = false) {
  return await prisma.product.create({
    data: {
      name,
      price,
      categoryId,
      isFavorite,
    },
    include: { category: true },
  });
}

export async function deleteProduct(productId) {
  return await prisma.product.delete({
    where: { id: productId },
  });
}

export async function updateProductFavorite(productId, newFavorite) {
  return await prisma.product.update({
    where: { id: productId },
    data: { isFavorite: newFavorite },
    include: { category: true },
  });
}

/* ---------- YENİ: Ürün Fiyat Güncelleme ---------- */
export async function updateProductPrice(productId, newPrice) {
  // İsteğe bağlı olarak parseFloat(newPrice) kullanabilirsiniz.
  return await prisma.product.update({
    where: { id: productId },
    data: { price: newPrice },
    include: { category: true },
  });
}

/* ---------- KATEGORİ İŞLEMLERİ ---------- */
export async function getCategories() {
  return await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createCategory(name) {
  return await prisma.category.create({
    data: { name },
  });
}

export async function deleteCategory(catId) {
  return await prisma.category.delete({
    where: { id: catId },
  });
}

/**
 * Ürünün categoryId alanını güncelleyen fonksiyon
 * @param {string} productId - Ürünün ID'si
 * @param {string|null} categoryId - Kategori ID'si veya null
 */
export async function updateProductCategory(productId, categoryId) {
  return await prisma.product.update({
    where: { id: productId },
    data: { categoryId },
    include: { category: true },
  });
}

/* ---------- MASA ALIAS GÜNCELLEME (YENİ) ---------- */
export async function renameTable(tableId, newAlias) {
  return await prisma.table.update({
    where: { id: tableId },
    data: { alias: newAlias },
  });
}
