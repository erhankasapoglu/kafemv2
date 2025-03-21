"use client";
import React, { useState, useEffect } from "react";

export default function StockPage() {
  // 1) Dropdown için tüm ürünler
  const [allProducts, setAllProducts] = useState([]);

  // 2) Tabloda gösterilecek ürünler (inStockList = true)
  const [stockList, setStockList] = useState([]);

  // Üst formdaki seçim/inputlar
  const [selectedProductId, setSelectedProductId] = useState("");
  const [stockValue, setStockValue] = useState("");
  const [criticalValue, setCriticalValue] = useState("");

  // Modal için state
  const [showModal, setShowModal] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalStock, setModalStock] = useState("");
  const [modalCritical, setModalCritical] = useState("");

  // ----------------------------------------------------------------
  // useEffect: İlk yüklemede hem /api/products hem /api/stock-list çek
  // ----------------------------------------------------------------
  useEffect(() => {
    loadAllProducts();
    loadStockList();
  }, []);

  async function loadAllProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Ürünler alınamadı");
      const data = await res.json();
      setAllProducts(data);
    } catch (err) {
      console.error("loadAllProducts hatası:", err);
    }
  }

  async function loadStockList() {
    try {
      const res = await fetch("/api/stock-list");
      if (!res.ok) throw new Error("Stok listesi alınamadı");
      const data = await res.json();
      setStockList(data);
    } catch (err) {
      console.error("loadStockList hatası:", err);
    }
  }

  // ----------------------------------------------------------------
  // "Stok Ekle" Butonu (Üst Form)
  // ----------------------------------------------------------------
  async function handleAddStock() {
    if (!selectedProductId) return;

    try {
      const res = await fetch(`/api/products/${selectedProductId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: parseInt(stockValue, 10),
          critical: parseInt(criticalValue, 10),
        }),
      });
      if (!res.ok) {
        console.error("Stok güncellenirken hata:", await res.text());
        return;
      }
      // Sunucudan dönen güncellenmiş ürün
      const updatedProd = await res.json();

      // Tabloyu yeniden çek (sadece inStockList = true olan ürünler)
      await loadStockList();

      // Formu sıfırla
      setSelectedProductId("");
      setStockValue("");
      setCriticalValue("");
    } catch (err) {
      console.error("handleAddStock hatası:", err);
    }
  }

  // ----------------------------------------------------------------
  // Tablodaki "+"" Butonu: Modal Aç
  // ----------------------------------------------------------------
  function openModal(product) {
    setModalProduct(product);
    setModalStock(product.stock.toString());
    setModalCritical(product.critical.toString());
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalProduct(null);
  }

  // ----------------------------------------------------------------
  // Modal'da "Kaydet"
  // ----------------------------------------------------------------
  async function handleModalSave() {
    if (!modalProduct) return;
    try {
      const res = await fetch(`/api/products/${modalProduct.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: parseInt(modalStock, 10),
          critical: parseInt(modalCritical, 10),
        }),
      });
      if (!res.ok) {
        console.error("Stok güncellenirken hata (modal):", await res.text());
        return;
      }
      // Sunucudan dönen güncellenmiş ürün
      const updatedProd = await res.json();

      // Tabloyu yeniden çek
      await loadStockList();

      closeModal();
    } catch (err) {
      console.error("handleModalSave hatası:", err);
    }
  }

  // ----------------------------------------------------------------
  // Tablodaki "Çöp Kutusu" Butonu: Ürünü stok takibinden kaldır
  // ----------------------------------------------------------------
  async function handleRemoveStock(productId) {
    try {
      // DELETE isteği ile ürünü stok listesinden kaldırıyoruz
      const res = await fetch(`/api/stock-list/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Ürün stok takibinden kaldırılamadı:", await res.text());
        return;
      }
      // Tabloyu yeniden çek
      await loadStockList();
    } catch (err) {
      console.error("handleRemoveStock hatası:", err);
    }
  }

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stok Yönetimi</h1>

      {/* Üst Form: Ürün Seç, Stok, Kritik, [Stok Ekle] */}
      <div className="mb-4">
        <label className="mr-2">Ürün Seç:</label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="border p-1"
        >
          <option value="">Seçiniz</option>
          {allProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Stok"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          className="ml-2 border p-1"
        />
        <input
          type="number"
          placeholder="Kritik"
          value={criticalValue}
          onChange={(e) => setCriticalValue(e.target.value)}
          className="ml-2 border p-1"
        />

        <button
          onClick={handleAddStock}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Stok Ekle
        </button>
      </div>

      {/* Tabloda Sadece inStockList = true Olan Ürünler */}
      <table className="border-collapse w-full">
        <thead>
          <tr>
            <th className="border p-2">Ürün Adı</th>
            <th className="border p-2">Stok</th>
            <th className="border p-2">Kritik</th>
            <th className="border p-2">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {stockList.map((p) => (
            <tr key={p.id} className={p.stock <= p.critical ? "bg-red-100" : ""}>
              <td className="border p-2">{p.name}</td>
              <td className="border p-2">{p.stock}</td>
              <td className="border p-2">{p.critical}</td>
              <td className="border p-2 flex gap-2 justify-center">
                {/* Yeşil + Butonu */}
                <button
                  onClick={() => openModal(p)}
                  className="px-3 py-1 bg-green-500 text-white rounded"
                >
                  +
                </button>
                {/* Kırmızı Çöp Butonu */}
                <button
                  onClick={() => handleRemoveStock(p.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {showModal && modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-4 rounded w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">{modalProduct.name}</h2>

            <label className="block mb-1">Stok:</label>
            <input
              type="number"
              className="border p-1 w-full mb-2"
              value={modalStock}
              onChange={(e) => setModalStock(e.target.value)}
            />

            <label className="block mb-1">Kritik:</label>
            <input
              type="number"
              className="border p-1 w-full mb-2"
              value={modalCritical}
              onChange={(e) => setModalCritical(e.target.value)}
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeModal}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                İptal
              </button>
              <button
                onClick={handleModalSave}
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
