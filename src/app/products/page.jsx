"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
// İlgili fonksiyonları projenize göre düzenleyin
import {
  getProducts,
  createProduct,
  deleteProduct,
  updateProductFavorite,
  updateProductPrice, // Fiyat güncelleme fonksiyonu
  getCategories,
  createCategory,
  deleteCategory,
  updateProductCategory,
} from "../orders/actions";

export default function ProductsPage() {
  // --------------------- 
  // State'ler
  // ---------------------
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);

  // Kategori yönetimi (ekleme/silme)
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Modal (Kategori Seç) için
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalProductId, setCategoryModalProductId] = useState(null);

  // Yeni: Fiyat Güncelle Modal'ı için state'ler
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState(null);
  const [modalPrice, setModalPrice] = useState("");

  // ---------------------
  // Verileri Yükleme
  // ---------------------
  useEffect(() => {
    async function loadData() {
      try {
        const prods = await getProducts();
        setProducts(prods);

        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("Veriler yüklenirken hata:", error);
      }
    }
    loadData();
  }, []);

  // ---------------------
  // Yeni Ürün Ekle
  // ---------------------
  async function handleAddProduct() {
    if (!productName.trim() || !productPrice.trim()) {
      alert("Ürün adı ve fiyatı zorunludur.");
      return;
    }
    const priceVal = parseFloat(productPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Fiyat sıfırdan büyük bir sayı olmalıdır.");
      return;
    }

    try {
      // Kategori bu formdan seçilmiyor, o yüzden categoryId = null
      const newProd = await createProduct(
        productName,
        priceVal,
        null,       // categoryId
        isFavorite  // Favori mi?
      );
      setProducts((prev) => [...prev, newProd]);

      // Formu sıfırla
      setProductName("");
      setProductPrice("");
      setIsFavorite(false);
    } catch (err) {
      console.error("Yeni ürün eklenirken hata:", err);
    }
  }

  // ---------------------
  // Ürün Sil
  // ---------------------
  async function handleDeleteProduct(id) {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Ürün silinirken hata:", err);
    }
  }

  // ---------------------
  // Favori Durumu Güncelle
  // ---------------------
  async function handleToggleFavorite(id, currentFavorite) {
    try {
      const updated = await updateProductFavorite(id, !currentFavorite);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? updated : p))
      );
    } catch (err) {
      console.error("Favori güncellenirken hata:", err);
    }
  }

  // ---------------------
  // Kategori Yönetimi
  // ---------------------
  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      alert("Kategori adı boş olamaz.");
      return;
    }
    try {
      const createdCat = await createCategory(newCategoryName);
      setCategories((prev) => [...prev, createdCat]);
      setNewCategoryName("");
    } catch (err) {
      console.error("Kategori eklenirken hata:", err);
    }
  }

  async function handleDeleteCategory(catId) {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteCategory(catId);
      setCategories((prev) => prev.filter((c) => c.id !== catId));

      const updatedProds = await getProducts();
      setProducts(updatedProds);
    } catch (err) {
      console.error("Kategori silinirken hata:", err);
    }
  }

  // ---------------------
  // Kategori Seç Modal
  // ---------------------
  function openCategoryModal(productId) {
    setCategoryModalProductId(productId);
    setShowCategoryModal(true);
  }

  function closeCategoryModal() {
    setShowCategoryModal(false);
    setCategoryModalProductId(null);
  }

  async function handleSelectCategoryForProduct(catId) {
    if (!categoryModalProductId) return;
    try {
      await updateProductCategory(categoryModalProductId, catId);
      const updatedList = await getProducts();
      setProducts(updatedList);
      closeCategoryModal();
    } catch (err) {
      console.error("Ürün kategorisi güncellenirken hata:", err);
    }
  }

  // ---------------------
  // Fiyat Güncelle Modal İşlemleri
  // ---------------------
  function openPriceModal(product) {
    setPriceModalProduct(product);
    setModalPrice(product.price.toString());
    setShowPriceModal(true);
  }

  function closePriceModal() {
    setShowPriceModal(false);
    setPriceModalProduct(null);
  }

  async function handlePriceModalSave() {
    if (!priceModalProduct) return;
    try {
      const updatedProd = await updateProductPrice(
        priceModalProduct.id,
        parseFloat(modalPrice)
      );
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProd.id ? updatedProd : p))
      );
      closePriceModal();
    } catch (err) {
      console.error("Fiyat güncellenirken hata:", err);
    }
  }

  // ---------------------
  // Arayüz
  // ---------------------
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Ürün Yönetimi</h1>
      <div className="mt-4">
        <Link href="/orders" className="px-4 py-2 bg-gray-200 rounded">
          &larr; Geri (Masalar Ekranı)
        </Link>
      </div>

      {/* Ürün Ekleme Formu */}
      <div className="bg-gray-100 p-4 mt-4 rounded max-w-md">
        <h2 className="text-lg font-semibold mb-2">Yeni Ürün Ekle</h2>
        <div className="flex flex-col gap-2 mb-4">
          <input
            type="text"
            className="border px-2 py-1"
            placeholder="Ürün adı"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <input
            type="number"
            className="border px-2 py-1"
            placeholder="Fiyat"
            value={productPrice}
            onChange={(e) => setProductPrice(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="font-semibold">Favori:</label>
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
            />
          </div>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Ekle
          </button>
        </div>
      </div>

      {/* Kategori Yönetimi */}
      <div className="bg-gray-100 p-4 mt-4 rounded max-w-md">
        <h2 className="text-lg font-semibold mb-2">Kategori Yönetimi</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="border px-2 py-1 flex-1"
            placeholder="Yeni kategori adı"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button
            onClick={handleCreateCategory}
            className="px-4 py-2 bg-blue-400 text-white rounded"
          >
            Ekle
          </button>
        </div>
        {categories.length === 0 ? (
          <div>Henüz kategori yok.</div>
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat.id} className="flex justify-between items-center">
                <span>{cat.name}</span>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="px-2 py-1 bg-red-400 text-white rounded text-sm"
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ürün Kartları */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.length === 0 ? (
          <div>Henüz ürün yok.</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-white p-4 rounded shadow flex flex-col">
              <div className="text-lg font-bold">{p.name}</div>
              <div className="text-gray-500">{p.price} TL</div>
              {p.category && (
                <div className="text-sm text-gray-600 mt-1">
                  Kategori: {p.category.name || p.category}
                </div>
              )}
              {p.isFavorite && (
                <div className="text-sm text-red-500 mt-1">Favori</div>
              )}
              <div className="mt-auto flex gap-2">
                <button
                  onClick={() => handleToggleFavorite(p.id, p.isFavorite)}
                  className="px-2 py-1 bg-blue-400 text-white rounded text-sm"
                >
                  {p.isFavorite ? "Favoriden Çıkar" : "Favoriye Ekle"}
                </button>
                <button
                  onClick={() => handleDeleteProduct(p.id)}
                  className="px-2 py-1 bg-red-400 text-white rounded text-sm"
                >
                  Sil
                </button>
                <button
                  onClick={() => {
                    setCategoryModalProductId(p.id);
                    setShowCategoryModal(true);
                  }}
                  className="px-2 py-1 bg-purple-500 text-white rounded text-sm"
                >
                  Kategori Seç
                </button>
                {/* Yeni: Fiyat Güncelle Butonu */}
                <button
                  onClick={() => openPriceModal(p)}
                  className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                >
                  Fiyat Güncelle
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fiyat Güncelle Modal */}
      {showPriceModal && priceModalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-full max-w-sm">
            <h2 className="text-xl font-bold mb-2">
              {priceModalProduct.name} - Yeni Fiyat
            </h2>
            <input
              type="number"
              className="border px-2 py-1 w-full"
              value={modalPrice}
              onChange={(e) => setModalPrice(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closePriceModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                İptal
              </button>
              <button
                onClick={handlePriceModalSave}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kategori Seç Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center">
          <div className="bg-white p-4 rounded w-80">
            <h2 className="text-xl font-bold mb-2">Kategoriler</h2>
            <div className="mb-4 max-h-60 overflow-y-auto">
              {categories.length === 0 ? (
                <div>Henüz kategori yok.</div>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex justify-between items-center border-b py-1"
                  >
                    <span>{cat.name}</span>
                    <button
                      onClick={async () => {
                        try {
                          await updateProductCategory(
                            categoryModalProductId,
                            cat.id
                          );
                          const updated = await getProducts();
                          setProducts(updated);
                          setShowCategoryModal(false);
                          setCategoryModalProductId(null);
                        } catch (err) {
                          console.error("Kategori güncellenirken hata:", err);
                        }
                      }}
                      className="text-blue-500 text-sm"
                    >
                      Seç
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setCategoryModalProductId(null);
                }}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
