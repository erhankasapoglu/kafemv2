"use client";
import React, { useState, useEffect, useRef } from "react";

// -- CustomDropdown Bileşeni (aşağı ok dahil) --
function CustomDropdown({ items, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Dışarı tıklayınca dropdown kapanması
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => setOpen(!open);

  const handleSelect = (item) => {
    onChange(item);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Butonu */}
      <button
        onClick={toggleDropdown}
        className="w-full border p-2 text-left relative"
      >
        {selected ? selected.name : placeholder}
        {/* Sağda aşağı ok */}
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          ▼
        </span>
      </button>

      {/* Açılır Liste */}
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className="p-2 hover:bg-gray-200 cursor-pointer"
            >
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Ana Sayfa (StockPage) Bileşeni --
export default function StockPage() {
  const [allProducts, setAllProducts] = useState([]);
  const [stockList, setStockList] = useState([]);

  // Seçilen ürünü nesne olarak saklıyoruz (ör. { id, name, ... })
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockValue, setStockValue] = useState("");
  const [criticalValue, setCriticalValue] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [modalStock, setModalStock] = useState("");
  const [modalCritical, setModalCritical] = useState("");

  // Sayfa yüklendiğinde verileri çek
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

  // "Stok Ekle" butonuna tıklanınca
  async function handleAddStock() {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}/stock`, {
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
      await loadStockList();
      // Formu sıfırla
      setSelectedProduct(null);
      setStockValue("");
      setCriticalValue("");
    } catch (err) {
      console.error("handleAddStock hatası:", err);
    }
  }

  // Modal aç
  function openModal(product) {
    setModalProduct(product);
    setModalStock(product.stock.toString());
    setModalCritical(product.critical.toString());
    setShowModal(true);
  }

  // Modal kapat
  function closeModal() {
    setShowModal(false);
    setModalProduct(null);
  }

  // Modal'da kaydet butonuna basınca
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
      await loadStockList();
      closeModal();
    } catch (err) {
      console.error("handleModalSave hatası:", err);
    }
  }

  // Ürünü stok listesinden kaldır
  async function handleRemoveStock(productId) {
    try {
      const res = await fetch(`/api/stock-list/${productId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Ürün stok takibinden kaldırılamadı:", await res.text());
        return;
      }
      await loadStockList();
    } catch (err) {
      console.error("handleRemoveStock hatası:", err);
    }
  }

  return (
    <div className="p-4">
      {/* Ürün Seçimi ve Stok Ekleme Formu */}
      <div className="mb-4">
        <label className="block mb-1">Ürün Seç:</label>
        {/* Dropdown'un altında fazladan boşluk için mb-4 ekliyoruz */}
        <div className="mb-4">
          <CustomDropdown
            items={allProducts}
            selected={selectedProduct}
            onChange={setSelectedProduct}
            placeholder="Seçiniz"
          />
        </div>

        <input
          type="number"
          placeholder="Stok"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          className="border p-1 w-full mb-2"
        />
        <input
          type="number"
          placeholder="Kritik"
          value={criticalValue}
          onChange={(e) => setCriticalValue(e.target.value)}
          className="border p-1 w-full mb-2"
        />

        <button
          onClick={handleAddStock}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Stok Ekle
        </button>
      </div>

      {/* Stok Listesi Tablosu */}
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
            <tr
              key={p.id}
              className={p.stock <= p.critical ? "bg-red-100" : ""}
            >
              <td className="border p-2">{p.name}</td>
              <td className="border p-2">{p.stock}</td>
              <td className="border p-2">{p.critical}</td>
              <td className="border p-2 flex gap-2 justify-center">
                <button
                  onClick={() => openModal(p)}
                  className="px-3 py-1 bg-green-500 text-white rounded"
                >
                  +
                </button>
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
