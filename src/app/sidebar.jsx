// src/app/sidebar.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Sidebar({ children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false); // İstatistikler alt menü açık/kapalı

  // Prefetch fonksiyonu: Fare menü öğesi üzerine gelince sayfayı önceden yükler
  function handleHover(route) {
    router.prefetch(route);
  }

  // Tıklama fonksiyonu: sayfaya git, menüyü kapat
  function handleClick(route) {
    router.push(route);
    setOpen(false);
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Üst Bar */}
      <header className="bg-[#003362] text-white p-2 flex items-center">
        <button onClick={() => setOpen(!open)} className="mr-2 text-2xl p-2">
          ☰
        </button>
        <h1 className="font-bold">Kafem</h1>
      </header>

      {/* Sayfa İçeriği */}
      <main>{children}</main>

      {/* Soldan açılan sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-screen w-64 bg-[#003362] text-white
          transform transition-transform duration-300 z-50
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4">
          {/* Kapat Butonu */}
          <button onClick={() => setOpen(false)} className="mb-4">
            X
          </button>

          {/* Ana Menü Butonları */}
          <nav className="flex flex-col gap-2">
            {/* Anasayfa */}
            <button
              onMouseEnter={() => handleHover("/")}
              onClick={() => handleClick("/")}
              className="hover:bg-gray-700 p-2 rounded text-left flex items-center"
            >
              <span className="w-6 inline-block">🏠</span>
              <span className="ml-1">Anasayfa</span>
            </button>

            {/* Masalar */}
            <button
              onMouseEnter={() => handleHover("/orders")}
              onClick={() => handleClick("/orders")}
              className="hover:bg-gray-700 p-2 rounded text-left flex items-center"
            >
              <span className="w-6 inline-block">🍽</span>
              <span className="ml-1">Masalar</span>
            </button>

            {/* Masa Yönetimi */}
            <button
              onMouseEnter={() => handleHover("/tables")}
              onClick={() => handleClick("/tables")}
              className="hover:bg-gray-700 p-2 rounded text-left flex items-center"
            >
              <span className="w-6 inline-block">🛠</span>
              <span className="ml-1">Masa Yönetimi</span>
            </button>

            {/* Ürün Yönetimi */}
            <button
              onMouseEnter={() => handleHover("/products")}
              onClick={() => handleClick("/products")}
              className="hover:bg-gray-700 p-2 rounded text-left flex items-center"
            >
              <span className="w-6 inline-block">🍔</span>
              <span className="ml-1">Ürün Yönetimi</span>
            </button>

            {/* Stok Yönetimi */}
            <button
              onMouseEnter={() => handleHover("/stock")}
              onClick={() => handleClick("/stock")}
              className="hover:bg-gray-700 p-2 rounded text-left flex items-center"
            >
              <span className="w-6 inline-block">📦</span>
              <span className="ml-1">Stok Yönetimi</span>
            </button>

            {/* İstatistikler (Alt Menü) */}
            <div>
              <button
                onClick={() => setStatsOpen(!statsOpen)}
                className="w-full text-left hover:bg-gray-700 p-2 rounded flex items-center"
              >
                <span className="w-6 inline-block">📊</span>
                <span className="ml-1">İstatistikler</span>
              </button>
              {statsOpen && (
                <div className="pl-4 flex flex-col gap-1 mt-1">
                  <button
                    onMouseEnter={() => handleHover("/statistics/paid")}
                    onClick={() => handleClick("/statistics/paid")}
                    className="hover:bg-gray-700 p-1 rounded text-left flex items-center"
                  >
                    <span className="w-6 inline-block">💳</span>
                    <span className="ml-1">Ödemeler</span>
                  </button>
                  <button
                    onMouseEnter={() => handleHover("/statistics/canceled")}
                    onClick={() => handleClick("/statistics/canceled")}
                    className="hover:bg-gray-700 p-1 rounded text-left flex items-center"
                  >
                    <span className="w-6 inline-block">❌</span>
                    <span className="ml-1">İptal Edilenler</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Arkada karartı (menü açıksa) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
