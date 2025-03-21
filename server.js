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
    // 1) GET /api/regions
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
    // 2) GET /api/products
    //--------------------------------------------------
    expressServer.get("/api/products", async (req, res) => {
      try {
        const products = await prisma.product.findMany({
          orderBy: { name: "asc" },
        });
        res.json(products);
      } catch (error) {
        console.error("Error in GET /api/products:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 2B) POST /api/products
    //--------------------------------------------------
    expressServer.post("/api/products", async (req, res) => {
      try {
        const { name, price, categoryId, isFavorite } = req.body;
        if (!name || price == null) {
          return res
            .status(400)
            .json({ error: "name ve price alanları gereklidir" });
        }

        const dataObj = {
          name,
          price: parseFloat(price),
          isFavorite: !!isFavorite,
        };

        if (categoryId) {
          dataObj.category = { connect: { id: categoryId } };
        }

        const newProd = await prisma.product.create({ data: dataObj });
        res.json(newProd);
      } catch (error) {
        console.error("Error in POST /api/products:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 3) GET /api/stock-list
    // Yalnızca inStockList = true olan ürünleri getirir.
    //--------------------------------------------------
    expressServer.get("/api/stock-list", async (req, res) => {
      try {
        const products = await prisma.product.findMany({
          where: { inStockList: true },
          orderBy: { name: "asc" },
        });
        res.json(products);
      } catch (error) {
        console.error("Error in GET /api/stock-list:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // Yeni: DELETE /api/stock-list/:id
    // İlgili ürünü stok takibinden kaldırmak için inStockList false yapılır.
    //--------------------------------------------------
    expressServer.delete("/api/stock-list/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedProduct = await prisma.product.update({
          where: { id },
          data: { inStockList: false },
        });
        res.json(updatedProduct);
      } catch (error) {
        console.error("Error in DELETE /api/stock-list/:id:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 4) PATCH /api/products/:id/stock
    // Stok ve kritik değer güncelleme endpoint’i
    // (inStockList: true olarak set ediliyor)
    //--------------------------------------------------
    expressServer.patch("/api/products/:id/stock", async (req, res) => {
      try {
        const { id } = req.params;
        const { stock, critical } = req.body;

        if (stock == null || critical == null) {
          return res
            .status(400)
            .json({ error: "stock ve critical alanları gereklidir" });
        }

        const updatedProduct = await prisma.product.update({
          where: { id },
          data: {
            stock: parseInt(stock, 10),
            critical: parseInt(critical, 10),
            inStockList: true, // Ürün stok listesine eklenmiş olsun.
          },
        });

        res.json(updatedProduct);
      } catch (error) {
        console.error("Error in PATCH /api/products/:id/stock:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // Yeni: PATCH /api/tables/:id/alias
    // Masa alias (özel isim) güncelleme endpoint’i
    //--------------------------------------------------
    expressServer.patch("/api/tables/:id/alias", async (req, res) => {
      try {
        const { id } = req.params;
        const { alias } = req.body;
        if (alias == null) {
          return res.status(400).json({ error: "alias alanı gereklidir" });
        }
        const updatedTable = await prisma.table.update({
          where: { id },
          data: { alias },
        });
        res.json(updatedTable);
      } catch (error) {
        console.error("Error in PATCH /api/tables/:id/alias:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 5) GET /api/region-tables-and-sessions
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
          include: {
            items: true,
            payments: true,
          },
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
    // 6) POST /api/open-table
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
    // 7) POST /api/cancel-table
    // İptal edilen masadaki ürünleri stoğa geri ekleyerek güncelleme
    //--------------------------------------------------
    expressServer.post("/api/cancel-table", async (req, res) => {
      try {
        const { sessionId } = req.body;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId required" });
        }
        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { items: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        for (const item of session.items) {
          if (item.productId) {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: {
            status: "canceled",
            closedAt: new Date(),
          },
          include: { items: true },
        });

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
    // 8) POST /api/pay-table
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
    // 9) POST /api/upsert-order-items
    // Gelen her ürün için productId üzerinden eski miktarı kontrol edip,
    // miktar farkına göre stok güncellemesi yapıyoruz.
    //--------------------------------------------------
    expressServer.post("/api/upsert-order-items", async (req, res) => {
      try {
        const { sessionId, items } = req.body;
        if (!sessionId || !items) {
          return res
            .status(400)
            .json({ error: "sessionId and items are required" });
        }

        const existingItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });

        for (const it of items) {
          const { productId, name, price, quantity } = it;
          const oldItem = existingItems.find((e) => e.productId === productId);
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = quantity - oldQty;

          if (productId) {
            if (diff > 0) {
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { decrement: diff } },
              });
            } else if (diff < 0) {
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { increment: Math.abs(diff) } },
              });
            }
          }

          if (quantity === 0) {
            await prisma.tableSessionItem.deleteMany({
              where: { tableSessionId: sessionId, productId: productId },
            });
          } else {
            await prisma.tableSessionItem.upsert({
              where: {
                tableSessionId_name: {
                  tableSessionId: sessionId,
                  name: name,
                },
              },
              update: { price, quantity, productId },
              create: { tableSessionId: sessionId, productId, name, price, quantity },
            });
          }
        }

        const allItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });
        const total = allItems.reduce(
          (acc, cur) => acc + cur.price * cur.quantity,
          0
        );

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { total },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: updatedSession.status,
          total: updatedSession.total,
        });

        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/upsert-order-items:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 10) POST /api/close-table
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
    // 11) GET /api/session-items
    //--------------------------------------------------
    expressServer.get("/api/session-items", async (req, res) => {
      try {
        const { sessionId } = req.query;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId is required" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { items: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const items = session.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        }));

        res.json(items);
      } catch (error) {
        console.error("Error in /api/session-items:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 12) GET /api/categories
    //--------------------------------------------------
    expressServer.get("/api/categories", async (req, res) => {
      try {
        const cats = await prisma.category.findMany({
          orderBy: { name: "asc" },
        });
        res.json(cats);
      } catch (error) {
        console.error("Error in GET /api/categories:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 13) POST /api/categories
    //--------------------------------------------------
    expressServer.post("/api/categories", async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res.status(400).json({ error: "Category name is required" });
        }
        const newCat = await prisma.category.create({
          data: { name },
        });
        res.json(newCat);
      } catch (error) {
        console.error("Error in POST /api/categories:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 14) GET /api/payment-stats (Opsiyonel İstatistik)
    //--------------------------------------------------
    expressServer.get("/api/payment-stats", async (req, res) => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const payments = await prisma.payment.findMany({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        const todayTotal = payments.reduce((acc, p) => acc + p.amount, 0);

        const methodTotals = {};
        payments.forEach((p) => {
          const m = p.method || "Diğer";
          if (!methodTotals[m]) methodTotals[m] = 0;
          methodTotals[m] += p.amount;
        });

        const hourlyTotals = {};
        for (let i = 0; i < 24; i++) {
          hourlyTotals[i] = 0;
        }
        payments.forEach((p) => {
          const hour = new Date(p.createdAt).getHours();
          hourlyTotals[hour] += p.amount;
        });
        const dailyData = Object.keys(hourlyTotals).map((hour) => ({
          hour: `${hour}:00`,
          amount: hourlyTotals[hour],
        }));

        const openOrdersTotal = 0;
        const guestCount = 0;

        res.json({
          todayTotal,
          openOrdersTotal,
          guestCount,
          methodTotals,
          dailyData,
        });
      } catch (error) {
        console.error("Error in /api/payment-stats:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 15) POST /api/partial-payment
    //--------------------------------------------------
    expressServer.post("/api/partial-payment", async (req, res) => {
      try {
        const { sessionId, method, amount } = req.body;
        if (!sessionId || amount == null) {
          return res
            .status(400)
            .json({ error: "sessionId ve amount zorunlu" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { payments: true },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        const payment = await prisma.payment.create({
          data: {
            tableSessionId: sessionId,
            method: method || "Nakit",
            amount: parseFloat(amount),
          },
        });

        const allPayments = [...session.payments, payment];
        const sumPaid = allPayments.reduce((acc, pay) => acc + pay.amount, 0);

        let updatedSession = null;
        if (sumPaid >= session.total) {
          updatedSession = await prisma.tableSession.update({
            where: { id: sessionId },
            data: {
              status: "paid",
              paymentMethod: method || "Nakit",
              closedAt: new Date(),
            },
            include: { items: true },
          });

          io.emit("tableUpdated", {
            sessionId,
            status: "paid",
            total: updatedSession.total,
          });
        }

        return res.json({
          payment,
          session: updatedSession ?? null,
        });
      } catch (error) {
        console.error("Error in /api/partial-payment:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 16) POST /api/partial-payment/bulk (opsiyonel)
    //--------------------------------------------------
    expressServer.post("/api/partial-payment/bulk", async (req, res) => {
      try {
        const { sessionId, payments } = req.body;
        if (!sessionId || !Array.isArray(payments)) {
          return res
            .status(400)
            .json({ error: "sessionId ve payments[] gerekli" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        await prisma.payment.createMany({
          data: payments.map((p) => ({
            tableSessionId: sessionId,
            method: p.method || "Nakit",
            amount: parseFloat(p.amount),
          })),
        });

        const updatedSession = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: { payments: true },
        });

        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/partial-payment/bulk:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 17) GET /api/session-details
    //--------------------------------------------------
    expressServer.get("/api/session-details", async (req, res) => {
      try {
        const { sessionId } = req.query;
        if (!sessionId) {
          return res.status(400).json({ error: "sessionId is required" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
          include: {
            items: true,
            payments: true,
          },
        });
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        res.json(session);
      } catch (err) {
        console.error("Error in /api/session-details:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--------------------------------------------------
    // 18) POST /api/transfer-table
    //--------------------------------------------------
    expressServer.post("/api/transfer-table", async (req, res) => {
      try {
        const { sessionId, newTableId } = req.body;
        if (!sessionId || !newTableId) {
          return res
            .status(400)
            .json({ error: "sessionId ve newTableId gerekli" });
        }

        const session = await prisma.tableSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          return res.status(404).json({ error: "Session yok" });
        }

        const newTable = await prisma.table.findUnique({
          where: { id: newTableId },
        });
        if (!newTable) {
          return res.status(404).json({ error: "Yeni masa yok" });
        }

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { tableId: newTableId },
          include: { items: true, payments: true },
        });

        io.emit("tableUpdated", {
          sessionId: updatedSession.id,
          status: updatedSession.status,
          total: updatedSession.total,
        });

        res.json(updatedSession);
      } catch (err) {
        console.error("Masa transferi hata:", err);
        res.status(500).json({ error: err.message });
      }
    });

    //--------------------------------------------------
    // 19) POST /api/upsert-order-items
    // Gelen her ürün için productId üzerinden eski miktarı kontrol edip,
    // miktar farkına göre stok güncellemesi yapıyoruz.
    //--------------------------------------------------
    expressServer.post("/api/upsert-order-items", async (req, res) => {
      try {
        const { sessionId, items } = req.body;
        if (!sessionId || !items) {
          return res
            .status(400)
            .json({ error: "sessionId and items are required" });
        }

        const existingItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });

        for (const it of items) {
          const { productId, name, price, quantity } = it;
          const oldItem = existingItems.find((e) => e.productId === productId);
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = quantity - oldQty;

          if (productId) {
            if (diff > 0) {
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { decrement: diff } },
              });
            } else if (diff < 0) {
              await prisma.product.update({
                where: { id: productId },
                data: { stock: { increment: Math.abs(diff) } },
              });
            }
          }

          if (quantity === 0) {
            await prisma.tableSessionItem.deleteMany({
              where: { tableSessionId: sessionId, productId: productId },
            });
          } else {
            await prisma.tableSessionItem.upsert({
              where: {
                tableSessionId_name: {
                  tableSessionId: sessionId,
                  name: name,
                },
              },
              update: { price, quantity, productId },
              create: { tableSessionId: sessionId, productId, name, price, quantity },
            });
          }
        }

        const allItems = await prisma.tableSessionItem.findMany({
          where: { tableSessionId: sessionId },
        });
        const total = allItems.reduce(
          (acc, cur) => acc + cur.price * cur.quantity,
          0
        );

        const updatedSession = await prisma.tableSession.update({
          where: { id: sessionId },
          data: { total },
          include: { items: true },
        });

        io.emit("tableUpdated", {
          sessionId,
          status: updatedSession.status,
          total: updatedSession.total,
        });

        res.json(updatedSession);
      } catch (error) {
        console.error("Error in /api/upsert-order-items:", error);
        res.status(500).json({ error: error.message });
      }
    });

    //--------------------------------------------------
    // 20) POST /api/close-table
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
      cors: { origin: "*" },
    });

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
