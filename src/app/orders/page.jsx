"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

export default function OrdersPage() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [products, setProducts] = useState([]);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTableIndex, setSelectedTableIndex] = useState(null);
  const [selectedQuantities, setSelectedQuantities] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // Socket bağlantısı için ref
  const socketRef = useRef(null);
  // Güncellemeleri izlemek için (opsiyonel)
  const [updates, setUpdates] = useState([]);

  // selectedRegion güncel kalması için
  // (Bu örnekte useEffect bağımlılıklarına selectedRegion eklediğimiz için ref kullanımı opsiyonel)
  // const selectedRegionRef = useRef(selectedRegion);
  // useEffect(() => { selectedRegionRef.current = selectedRegion; }, [selectedRegion]);

  // loadTablesForRegion fonksiyonunu useCallback ile sarmallıyoruz
  const loadTablesForRegion = useCallback(async (regionId) => {
    try {
      const res = await fetch(`/api/region-tables-and-sessions?regionId=${regionId}`);
      const data = await res.json();
      setTables(data.tables);
      const sArr = data.tables.map((t) => data.sessionMap[t.id] || null);
      setSessions(sArr);
    } catch (error) {
      console.error("Masalar yüklenirken hata:", error);
    }
  }, []);

  // Sunucudan ilk verileri çekme
  async function loadInitialData() {
    try {
      // Bölgeleri çek
      const regionsRes = await fetch("/api/regions");
      const regionsData = await regionsRes.json();
      setRegions(regionsData);

      // İlk bölgeyi seç ve masaları çek
      if (regionsData.length > 0) {
        setSelectedRegion(regionsData[0].id);
        await loadTablesForRegion(regionsData[0].id);
      }

      // Ürünleri çek
      const productsRes = await fetch("/api/products");
      const productsData = await productsRes.json();
      setProducts(productsData);
    } catch (error) {
      console.error("Initial data yüklenirken hata:", error);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [loadTablesForRegion]);

  useEffect(() => {
    // Socket.IO istemcisini başlat (örn: "http://localhost:3000" prod'da tam URL verin)
    const socket = io();
    socketRef.current = socket;

    // "tableUpdated" eventini dinle
    socket.on("tableUpdated", (data) => {
      console.log("Gelen güncelleme:", data);
      setUpdates((prev) => [...prev, data]);

      // Eğer status "open" ise, seçili bölgedeki masaları yeniden çek
      if (data.status === "open") {
        if (selectedRegion) {
          loadTablesForRegion(selectedRegion);
        }
        return;
      }

      // Diğer durumlarda (paid, canceled, closed) ilgili session'ı null yap
      setSessions((prev) =>
        prev.map((session) => {
          if (session && session.id === data.sessionId) {
            if (
              data.status === "paid" ||
              data.status === "canceled" ||
              data.status === "closed"
            ) {
              return null;
            } else if (data.status === "open") {
              return {
                ...session,
                status: "open",
                total: data.total !== undefined ? data.total : session.total,
              };
            }
          }
          return session;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedRegion, loadTablesForRegion]);

  // Bölge sekmesine tıklama
  async function handleRegionTabClick(regionId) {
    setSelectedRegion(regionId);
    await loadTablesForRegion(regionId);
    setShowOrderModal(false);
    setShowPaymentModal(false);
  }

  // Masa tıklama -> /api/open-table çağrısı
  async function handleTableClick(i) {
    try {
      const t = tables[i];
      if (!selectedRegion) return;
      const res = await fetch("/api/open-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId: selectedRegion, tableId: t.tableId }),
      });
      const session = await res.json();
      setSessions((prev) => {
        const copy = [...prev];
        copy[i] = session;
        return copy;
      });
      setSelectedTableIndex(i);

      // Ürün miktarlarını başlat
      const initQty = {};
      products.forEach((p) => {
        initQty[p.id] = 0;
      });
      if (session?.items) {
        for (let it of session.items) {
          const found = products.find((p) => p.name === it.name);
          if (found) {
            initQty[found.id] = it.quantity;
          }
        }
      }
      setSelectedQuantities(initQty);
      setShowOrderModal(true);
    } catch (error) {
      console.error("Masa açma hatası:", error);
    }
  }

  // Sipariş modalını kapatırken, sipariş 0 ise iptal et
  async function closeOrderModal() {
    setShowOrderModal(false);
    const s = sessions[selectedTableIndex];
    if (!s) return;
    const totalQty = Object.values(selectedQuantities).reduce((a, c) => a + c, 0);
    if (totalQty === 0) {
      await fetch("/api/cancel-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id }),
      });
      setSessions((prev) => {
        const copy = [...prev];
        copy[selectedTableIndex] = null;
        return copy;
      });
    }
  }

  // Sipariş ekle -> /api/upsert-order-items-bulk çağrısı
  async function handleAddOrder() {
    const s = sessions[selectedTableIndex];
    if (!s) return;
    const totalQty = Object.values(selectedQuantities).reduce((a, c) => a + c, 0);
    if (totalQty === 0) {
      await fetch("/api/cancel-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id }),
      });
      setSessions((prev) => {
        const copy = [...prev];
        copy[selectedTableIndex] = null;
        return copy;
      });
      setShowOrderModal(false);
      return;
    }
    const chosenItems = products.map((p) => ({
      name: p.name,
      price: p.price,
      quantity: selectedQuantities[p.id] || 0,
    }));
    const res = await fetch("/api/upsert-order-items-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.id, items: chosenItems }),
    });
    const updated = await res.json();
    setSessions((prev) => {
      const copy = [...prev];
      copy[selectedTableIndex] = updated;
      return copy;
    });
    setShowOrderModal(false);
  }

  // Masa iptal
  async function handleCancelTable(i) {
    const s = sessions[i];
    if (!s) return;
    await fetch("/api/cancel-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.id }),
    });
    setSessions((prev) => {
      const copy = [...prev];
      copy[i] = null;
      return copy;
    });
  }

  // Ödeme modalını aç
  function handlePaymentModal(i) {
    setSelectedTableIndex(i);
    setPaymentMethod("cash");
    setShowPaymentModal(true);
  }

  // Ödemeyi onayla
  async function handleConfirmPayment() {
    const s = sessions[selectedTableIndex];
    if (!s) return;
    await fetch("/api/pay-table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.id, paymentMethod }),
    });
    setSessions((prev) => {
      const copy = [...prev];
      copy[selectedTableIndex] = null;
      return copy;
    });
    setShowPaymentModal(false);
  }

  // Ürün miktarını artır/azalt
  function increment(prodId) {
    setSelectedQuantities((prev) => ({
      ...prev,
      [prodId]: (prev[prodId] || 0) + 1,
    }));
  }
  function decrement(prodId) {
    setSelectedQuantities((prev) => ({
      ...prev,
      [prodId]: Math.max((prev[prodId] || 0) - 1, 0),
    }));
  }

  return (
    <div className="p-4 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Ana Sayfa - Masa/Sipariş Yönetimi</h1>

      {/* Bölge Sekmeleri */}
      <div className="flex gap-2">
        {regions.map((r) => (
          <button
            key={r.id}
            onClick={() => handleRegionTabClick(r.id)}
            className={`px-3 py-1 rounded ${
              selectedRegion === r.id ? "bg-blue-600 text-white" : "bg-gray-300"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Masalar */}
      <div className="flex gap-4 flex-wrap mt-4">
        {tables.map((table, i) => {
          const session = sessions[i];
          let color = "bg-gray-200";
          let display = "Açılmamış";

          if (session) {
            const itemCount =
              session.items?.reduce((acc, cur) => acc + cur.quantity, 0) || 0;
            if (session.status === "open") {
              color = itemCount > 0 ? "bg-green-200" : "bg-gray-200";
              display = `Açık - ${session.total} TL`;
            } else if (session.status === "paid") {
              color = "bg-blue-200";
              display = `Ödendi - ${session.total} TL`;
            } else if (session.status === "canceled") {
              color = "bg-red-200";
              display = `İptal - ${session.total} TL`;
            }
          }

          return (
            <div
              key={table.id}
              className={`w-40 h-40 flex flex-col justify-center items-center cursor-pointer relative ${color}`}
              onClick={() => {
                if (!session || session.status === "open") {
                  handleTableClick(i);
                }
              }}
            >
              <div className="font-bold">Masa {table.tableId}</div>
              <div>{display}</div>
              {session && session.status === "open" && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePaymentModal(i);
                    }}
                    className="px-2 py-1 bg-blue-400 text-white rounded"
                  >
                    Öde
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelTable(i);
                    }}
                    className="px-2 py-1 bg-red-400 text-white rounded"
                  >
                    İptal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sipariş Ekle Modal */}
      {showOrderModal && selectedTableIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-4 rounded w-72">
            <h2 className="text-xl font-bold mb-2">
              Masa {tables[selectedTableIndex].tableId} Sipariş Ekle
            </h2>
            <div
              className="flex flex-col gap-4 mb-4"
              style={{ maxHeight: "300px", overflowY: "auto" }}
            >
              {products.length === 0 && <div>Menüde ürün yok.</div>}
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span>
                    {p.name} - {p.price} TL
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decrement(p.id)}
                      className="px-2 py-1 bg-gray-300 rounded"
                    >
                      -
                    </button>
                    <span>{selectedQuantities[p.id] || 0}</span>
                    <button
                      onClick={() => increment(p.id)}
                      className="px-2 py-1 bg-gray-300 rounded"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={closeOrderModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Kapat
              </button>
              <button
                onClick={handleAddOrder}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ödeme Modal */}
      {showPaymentModal && selectedTableIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-4 rounded">
            <h2 className="text-xl font-bold mb-2">
              Ödeme: Masa {tables[selectedTableIndex].tableId}
            </h2>
            <div className="flex gap-4 mb-4">
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span className="ml-2">Nakit</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span className="ml-2">Kart</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
