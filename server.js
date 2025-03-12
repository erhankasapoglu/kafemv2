// server.js

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const next = require("next");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

let io; // Socket.IO instance

async function main() {
  try {
    await app.prepare();

    const expressServer = express();
    expressServer.use(express.json()); // JSON body parsing

    //--------------------------------------------------
    // 1) GET /api/regions – Bölgeleri döndür
    //--------------------------------------------------
    expressServer.get("/api/regions", async (req, res) => {
      try {
        const regions = await prisma.region.findMany({
          orderBy: { name: "asc" },
        });
        res.json(regions);
      } catch (error) {
        console.error("Error in /api/regions:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 2) GET /api/products – Ürünleri döndür
    //--------------------------------------------------
    expressServer.get("/api/products", async (req, res) => {
      try {
        const products = await prisma.product.findMany({
          orderBy: { name: "asc" },
        });
        res.json(products);
      } catch (error) {
        console.error("Error in /api/products:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 3) GET /api/region-tables-and-sessions
    //    Seçili bölgedeki masaları ve açık session'ları döndür
    //--------------------------------------------------
    expressServer.get("/api/region-tables-and-sessions", async (req, res) => {
      try {
        const { regionId } = req.query;
        if (!regionId) {
          return res.status(400).json({ error: "regionId is required" });
        }

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

        res.json({ tables, sessionMap });
      } catch (error) {
        console.error("Error in /api/region-tables-and-sessions:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 4) POST /api/open-table
    //    Masa açar; açık değilse yeni session oluşturur
    //--------------------------------------------------
    expressServer.post("/api/open-table", async (req, res) => {
      try {
        const { regionId, tableId } = req.body;
        if (!regionId || tableId == null) {
          return res
            .status(400)
            .json({ error: "regionId and tableId are required" });
        }

        const tableData = await prisma.table.findFirst({
          where: { regionId, tableId },
        });
        if (!tableData) {
          return res.status(404).json({ error: "Table not found" });
        }

        // Zaten açık session varsa onu döndür
        let session = await prisma.tableSession.findFirst({
          where: { tableId: tableData.id, status: "open" },
          include: { items: true },
        });

        // Yoksa yeni session oluştur
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

        // Diğer tarayıcılar da masanın "open" olduğunu görsün
        io.emit("tableUpdated", {
          sessionId: session.id,
          status: "open",
          total: session.total,
        });

        res.json(session);
      } catch (error) {
        console.error("Error in /api/open-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 5) POST /api/cancel-table
    //    Oturumu iptal eder (status: "canceled")
    //--------------------------------------------------
    expressServer.post("/api/cancel-table", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId required" });
        }
        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: {
            status: "canceled",
            closedAt: new Date(),
          },
          include: { items: true },
        });

        // İptal event'i
        io.emit("tableUpdated", {
          sessionId,
          status: "canceled",
          total: updatedSession.total,
        });
        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/cancel-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 6) POST /api/pay-table
    //    Oturumu öder (status: "paid")
    //--------------------------------------------------
    expressServer.post("/api/pay-table", async (req, res) => {
      try {
        const { sessionId, paymentMethod } = req.body;
        if (!sessionId || !paymentMethod) {
          return res
            .status(400)
            .json({ error: "sessionId and paymentMethod are required" });
        }
        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (session.status !== "open") {
          return res.status(400).json({ error: "Session is not open" });
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: {
            status: "paid",
            paymentMethod,
            closedAt: new Date(),
          },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: "paid",
          total: updatedSession.total,
        });
        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/pay-table:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 7) POST /api/upsert-order-items-bulk
    //    Sipariş kalemlerini toplu güncelle, total'i hesapla
    //--------------------------------------------------
    expressServer.post("/api/upsert-order-items-bulk", async (req, res) => {
      try {
        const { sessionId, items } = req.body;
        if (!sessionId || !items) {
          return res
            .status(400)
            .json({ error: "sessionId and items are required" });
        }

        // Mevcut kalemleri sil
        await prisma.tableSessionItem.deleteMany({
          where: { tableSessionId: sessionId },
        });

        // Yeni kalemleri ekle
        await prisma.tableSessionItem.createMany({
          data: items
            .filter((it) => it.quantity > 0)
            .map((it) => ({
              tableSessionId: sessionId,
              name: it.name,
              price: it.price,
              quantity: it.quantity,
            })),
        });

        // total hesapla
        const allItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });
        const total = allItems.reduce(
          (acc, cur) => acc + cur.price * cur.quantity,
          0
        );

        // Session'ı güncelle
        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { total },
          include: { items: true },
        });

        // Masa hâlâ "open" durumunda, ama total değişti
        io.emit("tableUpdated", {
          sessionId,
          status: "open",
          total: updatedSession.total,
        });
        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/upsert-order-items-bulk:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 8) POST /api/close-table
    //    Oturumu kapatır (status: "closed")
    //--------------------------------------------------
    expressServer.post("/api/close-table", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId required" });
        }
        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { status: "closed", closedAt: new Date() },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: "closed",
          total: updatedSession.total,
        });
        return res.status(200).json({ success: true, session: updatedSession });
      } catch (error) {
        console.error("Error in /api/close-table:", error);
        return res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // Next.js sayfalarını yönlendirme
    //--------------------------------------------------
    expressServer.all("*", (req, res) => {
      return handle(req, res);
    });

    //--------------------------------------------------
    // HTTP + Socket.IO Sunucusu
    //--------------------------------------------------
    const httpServer = http.createServer(expressServer);
    io = new Server(httpServer, {
      cors: {
        origin: "*",
      },
    });

    // Socket.IO connection
    io.on("connection", (socket) => {
      console.log("Bir kullanıcı bağlandı:", socket.id);

      socket.on("mesaj", (data) => {
        console.log("Gelen mesaj:", data);
        io.emit("mesaj", data);
      });

      socket.on("disconnect", () => {
        console.log("Bir kullanıcı ayrıldı:", socket.id);
      });
    });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`Sunucu ${PORT} portunda çalışıyor`);
    });
  } catch (err) {
    console.error("Sunucu başlatılırken hata oluştu:", err);
  }
}

main();
