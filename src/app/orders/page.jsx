"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

export default function OrdersPage() {
  const router = useRouter();

  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Ödeme modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTableIndex, setSelectedTableIndex] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentType, setPaymentType] = useState("full");

  // Menü
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);

  // MASA DEĞİŞTİR: Modal + state
  const [showChangeTableModal, setShowChangeTableModal] = useState(false);
  const [tableIndexToChange, setTableIndexToChange] = useState(null);
  const [changeRegion, setChangeRegion] = useState("");
  const [emptyTables, setEmptyTables] = useState([]);

  // Socket.IO
  const socketRef = useRef(null);
  const [updates, setUpdates] = useState([]);

  // 1) MASALARI + SESSIONS YÜKLE
  const loadTablesForRegion = useCallback(async (regionId) => {
    try {
      const res = await fetch(`/api/region-tables-and-sessions?regionId=${regionId}`);
      const data = await res.json();

      setTables(data.tables);
      const sArr = data.tables.map((t) => {
        let s = data.sessionMap[t.id] || null;
        if (s && s.items && s.items.length === 0) {
          s = null;
        }
        return s;
      });
      setSessions(sArr);
    } catch (error) {
      console.error("Masalar yüklenirken hata:", error);
    }
  }, []);

  // 2) İLK YÜKLEME
  async function loadInitialData() {
    try {
      const regionsRes = await fetch("/api/regions");
      const regionsData = await regionsRes.json();
      setRegions(regionsData);

      if (regionsData.length > 0) {
        setSelectedRegion(regionsData[0].id);
        await loadTablesForRegion(regionsData[0].id);
      }
    } catch (error) {
      console.error("Initial data hata:", error);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [loadTablesForRegion]);

  // 3) SOCKET.IO
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("tableUpdated", (data) => {
      console.log("Gelen güncelleme:", data);
      setUpdates((prev) => [...prev, data]);

      if (data.status === "open") {
        if (selectedRegion) {
          loadTablesForRegion(selectedRegion);
        }
        return;
      }

      setSessions((prev) =>
        prev.map((session) => {
          if (session && session.id === data.sessionId) {
            if (["paid", "canceled", "closed"].includes(data.status)) {
              return null;
            } else if (data.status === "open") {
              return {
                ...session,
                status: "open",
                total: data.total ?? session.total,
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

  // 4) BÖLGE SEKME
  async function handleRegionTabClick(regionId) {
    setSelectedRegion(regionId);
    await loadTablesForRegion(regionId);
    setShowPaymentModal(false);
    setMenuOpenIndex(null);
  }

  // 5) MASAYA TIKLAYINCA OPEN
  async function handleTableClick(i) {
    const t = tables[i];
    if (!selectedRegion) return;

    try {
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

      router.push(`/tables/${t.id}?regionId=${selectedRegion}&sessionId=${session.id}`);
    } catch (err) {
      console.error("Masa açma hatası:", err);
    }
  }

  // 6) MASA İPTAL
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
    setMenuOpenIndex(null);
  }

  // 7) MENÜ (3 nokta)
  function openMenuSheet(e, i) {
    e.stopPropagation();
    setMenuOpenIndex(i);
  }
  function closeMenuSheet() {
    setMenuOpenIndex(null);
  }

  // 8) ÖDEME MODAL
  function handlePaymentModal(i) {
    setSelectedTableIndex(i);
    setPaymentMethod("cash");
    setPaymentType("full");
    setShowPaymentModal(true);
    setMenuOpenIndex(null);
  }
  function handlePartialPaymentModal(i) {
    setSelectedTableIndex(i);
    setPaymentMethod("cash");
    setPaymentType("partial");
    setShowPaymentModal(true);
    setMenuOpenIndex(null);
  }

  async function handleConfirmPayment() {
    const s = sessions[selectedTableIndex];
    if (!s) return;

    if (paymentType === "full") {
      await fetch("/api/pay-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: s.id, paymentMethod }),
      });
    } else {
      const sumPaid = s.payments ? s.payments.reduce((acc, pay) => acc + pay.amount, 0) : 0;
      const remaining = s.total - sumPaid;
      if (remaining <= 0) {
        alert("Bu masada ödenecek bir tutar kalmadı.");
        return;
      }
      await fetch("/api/partial-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s.id,
          method: paymentMethod,
          amount: remaining,
        }),
      });
    }

    setSessions((prev) => {
      const copy = [...prev];
      copy[selectedTableIndex] = null;
      return copy;
    });
    setShowPaymentModal(false);
  }

  // 9) MASAYI DEĞİŞTİR
  function handleChangeTable() {
    setTableIndexToChange(menuOpenIndex);
    setShowChangeTableModal(true);
    closeMenuSheet();
  }
  
  function handleMergeTable() {
    alert("Masaları Birleştir (placeholder).");
    closeMenuSheet();
  }

  // BÖLGE SEÇİMİ -> Boş Masaları Getir
  async function handleRegionSelect(newRegionId) {
    setChangeRegion(newRegionId);
    if (!newRegionId) {
      setEmptyTables([]);
      return;
    }
    try {
      const res = await fetch(`/api/region-tables-and-sessions?regionId=${newRegionId}`);
      const data = await res.json();

      const localTables = data.tables;
      const sessionMap = data.sessionMap;

      const empties = localTables.filter((t) => {
        const s = sessionMap[t.id];
        if (!s) return true;
        if (s.items && s.items.length === 0) return true;
        return false;
      });

      setEmptyTables(empties);
    } catch (err) {
      console.error("Bölge boş masalar hata:", err);
    }
  }

  // MASA TRANSFER
  async function handleTransferTable(newTableId) {
    try {
      const s = sessions[tableIndexToChange];
      if (!s) return;

      const resp = await fetch("/api/transfer-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: s.id,
          newTableId,
        }),
      });
      if (!resp.ok) {
        throw new Error("Masa aktarılırken hata oluştu.");
      }

      // Yeniden yükle
      if (selectedRegion) {
        await loadTablesForRegion(selectedRegion);
      }

      setShowChangeTableModal(false);
    } catch (err) {
      console.error("Masa aktarılırken hata oluştu:", err);
      alert("Masa aktarılırken hata oluştu.");
    }
  }

  // 10) RENDER
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* BÖLGE SEKME LİSTESİ */}
      <div className="flex border-b border-gray-300 bg-white overflow-x-auto">
        {regions.map((r) => {
          const isActive = selectedRegion === r.id;
          return (
            <button
              key={r.id}
              onClick={() => handleRegionTabClick(r.id)}
              className={`flex-1 text-center py-3 font-semibold transition-colors ${
                isActive
                  ? "text-red-600 border-b-2 border-red-600"
                  : "text-gray-600"
              }`}
            >
              {r.name}
            </button>
          );
        })}
      </div>

      {/* MASALAR */}
      <div className="p-4 grid grid-cols-3 grid-rows-8 gap-4">
        {tables.map((table, i) => {
          const session = sessions[i];
          if (!session) {
            // Masa boş
            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(i)}
                className="relative rounded-md border border-gray-300 bg-white
                           cursor-pointer text-center aspect-[2/1]
                           flex flex-col items-center justify-center"
              >
                <div className="font-bold text-gray-700">
                  {table.alias ? table.alias : `Masa ${table.tableId}`}
                </div>
              </div>
            );
          }

          const sumPaid = session.payments
            ? session.payments.reduce((acc, pay) => acc + pay.amount, 0)
            : 0;
          const total = session.total;
          const remaining = Math.max(total - sumPaid, 0);

          let containerClass = `
            relative
            rounded-md
            border border-gray-300
            bg-white
            cursor-pointer
            text-center
            aspect-[2/1]
            flex
            flex-col
            items-center
            justify-center
          `;
          if (session.status === "open") {
            containerClass += " border-red-500 border-2";
          } else if (session.status === "paid") {
            containerClass += " bg-blue-100";
          } else if (session.status === "canceled") {
            containerClass += " bg-gray-200";
          }

          return (
            <div
              key={table.id}
              onClick={() => {
                if (session.status === "open") {
                  handleTableClick(i);
                }
              }}
              className={containerClass}
            >
              <div className="font-bold text-gray-700">
                {table.alias ? table.alias : `Masa ${table.tableId}`}
              </div>
              <div className="text-sm text-gray-600 mt-0">
                {sumPaid === 0
                  ? `${total} TL`
                  : `${sumPaid} / ${total} TL (Kalan: ${remaining})`}
              </div>

              {session.status === "open" && (
                <button
                  onClick={(e) => openMenuSheet(e, i)}
                  className="absolute top-2 right-2 text-gray-500 text-xl"
                >
                  &#8942;
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* BOTTOM SHEET MENÜ */}
      {menuOpenIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50
                     transition-all duration-500"
          onClick={closeMenuSheet}
        >
          <div
            className="bg-white rounded-t-xl p-4 transform transition-transform
                       duration-500 translate-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {(() => {
                const s = sessions[menuOpenIndex];
                if (!s) return null;

                const sumPaid = s.payments
                  ? s.payments.reduce((acc, pay) => acc + pay.amount, 0)
                  : 0;
                const remaining = Math.max(s.total - sumPaid, 0);

                return (
                  <>
                    <button
                      onClick={() => handlePartialPaymentModal(menuOpenIndex)}
                      className="text-left px-2 py-2 hover:bg-gray-100 rounded"
                    >
                      {`Hızlı Öde (${remaining} ₺)`}
                    </button>
                    <button
                      onClick={() => handleCancelTable(menuOpenIndex)}
                      className="text-left px-2 py-2 hover:bg-gray-100 rounded"
                    >
                      Masa İptal
                    </button>
                  </>
                );
              })()}

              <button
                onClick={handleChangeTable}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded"
              >
                Masayı Değiştir
              </button>
              <button
                onClick={handleMergeTable}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded"
              >
                Masaları Birleştir
              </button>
              <button
                onClick={closeMenuSheet}
                className="text-left px-2 py-2 hover:bg-gray-100 rounded"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÖDEME MODAL */}
      {showPaymentModal && selectedTableIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow w-72">
            <h2 className="text-xl font-bold mb-2">
              Masa {tables[selectedTableIndex].tableId} Ödeme
            </h2>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span>Nakit</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span>Kart</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
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

      {/* MASA DEĞİŞTİR MODALI */}
      {showChangeTableModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-4 w-72">
            <h2 className="text-sm font-bold mb-2">Masayı Değiştir</h2>

            <label className="block text-xs font-semibold mb-1">Bölge Seç:</label>
            <select
              className="border px-2 py-1 text-xs w-full mb-2"
              value={changeRegion}
              onChange={(e) => handleRegionSelect(e.target.value)}
            >
              <option value="">-- Seçiniz --</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {changeRegion && (
              <div className="max-h-48 overflow-y-auto border p-2 mb-2">
                {emptyTables.length === 0 ? (
                  <div className="text-xs text-gray-500">Boş masa yok</div>
                ) : (
                  emptyTables.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleTransferTable(t.id)}
                      className="p-1 border mb-1 cursor-pointer text-xs text-center hover:bg-gray-100"
                    >
                      Masa {t.tableId}
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowChangeTableModal(false)}
                className="bg-gray-300 px-2 py-1 text-xs"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
