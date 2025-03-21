"use client";
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function TableDetailPage() {
  const params = useParams();
  const tableId = params.tableId;
  const searchParams = useSearchParams();
  const regionId = searchParams.get("regionId");
  const sessionId = searchParams.get("sessionId");
  const router = useRouter();

  // Kategoriler / Ürünler
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState("");

  // Sipariş miktarları
  const [quantities, setQuantities] = useState({});

  // Session verisinin tamı (items + payments)
  const [sessionData, setSessionData] = useState(null);

  // Ürün listesi (DB'den gelen session item'ları)
  const [sessionItems, setSessionItems] = useState([]);

  // Ödeme paneli
  const [showPayment, setShowPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState("0");

  // --------------------------------------------------
  // 1) İlk verileri yükleme
  // --------------------------------------------------
  useEffect(() => {
    if (!sessionId) {
      alert("Session yok. Lütfen openTable üzerinden gelin.");
      return;
    }
    loadCategories();
    loadProducts();
    loadSessionFullData();
  }, [sessionId]);

  async function loadSessionFullData() {
    try {
      const resp = await fetch(`/api/session-details?sessionId=${sessionId}`);
      const data = await resp.json();
      if (data.error) {
        console.error("session-details error:", data.error);
        return;
      }
      setSessionData(data);
      setSessionItems(data.items); // Session item'ları
    } catch (err) {
      console.error("loadSessionFullData hata:", err);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Kategoriler yüklenirken hata:", err);
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (err) {
      console.error("Ürünleri yüklerken hata:", err);
    }
  }

  // --------------------------------------------------
  // 2) sessionItems + products geldikten sonra quantities'i başlat
  // --------------------------------------------------
  useEffect(() => {
    if (products.length === 0) return;
    const initQuantities = {};
    sessionItems.forEach((item) => {
      // Eğer item.productId varsa onu kullan, yoksa name üzerinden eşleştir
      const prod = item.productId
        ? products.find((p) => p.id === item.productId)
        : products.find((p) => p.name === item.name);
      if (prod) {
        initQuantities[prod.id] = item.quantity;
      }
    });
    setQuantities(initQuantities);
  }, [sessionItems, products]);

  // --------------------------------------------------
  // 3) Kategori / arama filtrelemesi
  // --------------------------------------------------
  useEffect(() => {
    filterProducts();
  }, [selectedCategoryId, searchText, products]);

  function filterProducts() {
    let temp = [...products];
    if (selectedCategoryId === "favorites") {
      temp = temp.filter((p) => p.isFavorite);
    } else if (selectedCategoryId !== "all") {
      temp = temp.filter((p) => p.categoryId === selectedCategoryId);
    }
    if (searchText) {
      temp = temp.filter((p) =>
        p.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    setFilteredProducts(temp);
  }

  function handleCategoryTabClick(catId) {
    setSelectedCategoryId(catId);
  }

  // --------------------------------------------------
  // 4) Miktar artır/azalt
  // --------------------------------------------------
  function increment(prodId) {
    setQuantities((prev) => ({
      ...prev,
      [prodId]: (prev[prodId] || 0) + 1,
    }));
  }
  function decrement(prodId) {
    setQuantities((prev) => ({
      ...prev,
      [prodId]: Math.max((prev[prodId] || 0) - 1, 0),
    }));
  }

  // --------------------------------------------------
  // 5) Kaydet (Upsert Order Items)
  // --------------------------------------------------
  async function handleSaveOrder() {
    if (!sessionId) return;

    const chosenItems = Object.entries(quantities).map(([prodId, qty]) => {
      const prod = products.find((p) => p.id === prodId);
      return {
        productId: prod.id, // Yeni: productId gönderiliyor
        name: prod.name,
        price: prod.price,
        quantity: qty,
      };
    });

    try {
      await fetch("/api/upsert-order-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, items: chosenItems }),
      });
      await loadSessionFullData();
      router.push("/orders");
    } catch (err) {
      console.error("Sipariş kaydetme hatası:", err);
    }
  }

  // --------------------------------------------------
  // 6) Toplam Tutar, Ödenen Tutar, Kalan
  // --------------------------------------------------
  function getSessionTotal() {
    return sessionData ? sessionData.total : 0;
  }
  function getSumPaid() {
    if (!sessionData || !sessionData.payments) return 0;
    return sessionData.payments.reduce((acc, pay) => acc + pay.amount, 0);
  }
  const total = getSessionTotal();
  const sumPaid = getSumPaid();
  const remaining = total - sumPaid;

  // --------------------------------------------------
  // 7) Kısmi Ödeme Paneli
  // --------------------------------------------------
  const partial = parseFloat(partialAmount) || 0;
  function handleKeyPress(val) {
    let newAmountStr = partialAmount;

    if (val === "←") {
      if (partialAmount.length <= 1) {
        newAmountStr = "0";
      } else {
        newAmountStr = partialAmount.slice(0, -1);
      }
    } else if (val === ".") {
      if (!partialAmount.includes(".")) {
        newAmountStr = partialAmount + ".";
      }
    } else {
      if (partialAmount === "0") {
        newAmountStr = val;
      } else {
        newAmountStr = partialAmount + val;
      }
    }

    const newVal = parseFloat(newAmountStr);
    if (!isNaN(newVal) && newVal > remaining) {
      newAmountStr = remaining.toString();
    }
    setPartialAmount(newAmountStr);
  }

  async function handlePay(method) {
    if (!sessionId) return;
    const amountVal = parseFloat(partialAmount) || 0;
    if (amountVal <= 0) {
      alert("Sıfırdan büyük bir tutar girin.");
      return;
    }
    try {
      const response = await fetch("/api/partial-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          method: method === "card" ? "Kredi Kartı" : "Nakit",
          amount: amountVal,
        }),
      });
      if (!response.ok) {
        throw new Error("Kısmi ödeme kaydedilirken hata oluştu!");
      }
      alert(`Kısmi Ödeme Kaydedildi: ₺${amountVal} (${method})`);
      setPartialAmount("0");
      await loadSessionFullData();
    } catch (err) {
      console.error("Ödeme hatası:", err);
      alert("Ödeme sırasında hata: " + err.message);
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="relative min-h-screen pb-20">
      {/* Arama */}
      <div className="p-4">
        <input
          type="text"
          placeholder="Ürün ara..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="px-3 py-2 border rounded w-full max-w-md"
        />
      </div>

      {/* Kategori Grid */}
      <div className="p-2 grid grid-cols-3 gap-2 border-b border-gray-300 bg-white">
        <button
          onClick={() => handleCategoryTabClick("all")}
          className={`h-10 px-2 border rounded text-center font-semibold transition-colors ${
            selectedCategoryId === "all"
              ? "bg-blue-200 text-blue-800"
              : "bg-gray-100 text-gray-700"
          } text-xs leading-tight`}
        >
          Hepsi
        </button>
        <button
          onClick={() => handleCategoryTabClick("favorites")}
          className={`h-10 px-2 border rounded text-center font-semibold transition-colors ${
            selectedCategoryId === "favorites"
              ? "bg-blue-200 text-blue-800"
              : "bg-gray-100 text-gray-700"
          } text-xs leading-tight`}
        >
          Favoriler
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryTabClick(cat.id)}
            className={`h-10 px-6 border rounded text-center font-semibold transition-colors ${
              selectedCategoryId === cat.id
                ? "bg-blue-200 text-blue-800"
                : "bg-gray-100 text-gray-700"
            } text-xs leading-tight`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Ürün Listesi */}
      <div className="p-4 grid grid-cols-3 gap-4 auto-rows-fr">
        {filteredProducts.map((p) => {
          const productQty = quantities[p.id] || 0;
          return (
            <div
              key={p.id}
              onClick={() => increment(p.id)}
              className="border rounded p-2 flex flex-col h-full cursor-pointer bg-white"
            >
              <div className="mb-2 text-sm text-center">
                <div className="font-semibold">{p.name}</div>
                <div className="text-gray-600">{p.price} TL</div>
              </div>
              <div className="mt-auto flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    decrement(p.id);
                  }}
                  className="bg-gray-200 rounded px-2 py-1 text-sm"
                >
                  -
                </button>
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    productQty > 0
                      ? "bg-[#ffc7c8] text-black font-semibold"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {productQty}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    increment(p.id);
                  }}
                  className="bg-gray-200 rounded px-2 py-1 text-sm"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alt Butonlar */}
      <div className="fixed bottom-0 left-0 w-full p-2 bg-white border-t border-gray-300 flex gap-2">
        <button
          onClick={() => router.push("/orders")}
          className="flex-1 py-2 bg-gray-500 text-white font-semibold rounded"
        >
          Geri
        </button>
        <button
          onClick={handleSaveOrder}
          className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded"
        >
          Kaydet
        </button>
        <button
          onClick={() => setShowPayment(true)}
          className="flex-1 py-2 bg-green-600 text-white font-semibold rounded"
        >
          Ödeme Al
        </button>
      </div>

      {/* Ödeme Paneli */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Ödeme Al</h2>
            <button
              onClick={() => router.push("/orders")}
              className="text-red-500 font-semibold"
            >
              Kapat
            </button>
          </div>
          <div className="mt-2 text-center font-medium">
            Toplam: <span className="font-bold">{total.toFixed(2)}</span>
            <br />
            Ödenen: <span className="font-bold">{sumPaid.toFixed(2)}</span>
            <br />
            Kalan:{" "}
            <span className="font-bold">
              {(remaining < 0 ? 0 : remaining).toFixed(2)}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto mt-4 border-t border-b">
            {sessionItems.map((item, idx) => (
              <div key={idx} className="py-2 px-2 border-b">
                <div className="font-semibold">
                  {item.name} x {item.quantity}
                </div>
                <div className="text-sm text-gray-500">
                  Fiyat: {item.price} TL | Toplam:{" "}
                  {(item.price * item.quantity).toFixed(2)} TL
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-2 text-center font-medium">
              Girilen Tutar: ₺{partial.toFixed(2)}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <button
                onClick={() => handleKeyPress("7")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                7
              </button>
              <button
                onClick={() => handleKeyPress("8")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                8
              </button>
              <button
                onClick={() => handleKeyPress("9")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                9
              </button>
              <button
                onClick={() => handlePay("card")}
                className="bg-gray-200 text-black py-4 text-sm rounded font-semibold"
              >
                Kartla Öde
              </button>
              <button
                onClick={() => handleKeyPress("4")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                4
              </button>
              <button
                onClick={() => handleKeyPress("5")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                5
              </button>
              <button
                onClick={() => handleKeyPress("6")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                6
              </button>
              <button
                onClick={() => handlePay("cash")}
                className="bg-gray-200 text-black py-4 text-sm rounded font-semibold"
              >
                Nakit Öde
              </button>
              <button
                onClick={() => handleKeyPress("1")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                1
              </button>
              <button
                onClick={() => handleKeyPress("2")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                2
              </button>
              <button
                onClick={() => handleKeyPress("3")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                3
              </button>
              <div className="bg-transparent" />
              <button
                onClick={() => handleKeyPress(".")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                .
              </button>
              <button
                onClick={() => handleKeyPress("0")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                0
              </button>
              <button
                onClick={() => handleKeyPress("←")}
                className="bg-gray-200 py-4 text-lg rounded font-semibold"
              >
                ←
              </button>
              <div className="bg-transparent" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
