"use client";

import React, { useEffect, useState } from "react";
import {
  getRegions,
  createRegion,
  deleteRegion,
  getTablesByRegion,
  addTable,
  deleteTable,
  // Önemli: renameTable fonksiyonunuz server'da tanımlı olmalı
  renameTable,
} from "../orders/actions";

export default function TablesManagementPage() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tables, setTables] = useState([]);
  const [newRegionName, setNewRegionName] = useState("");

  // Modal için state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTableId, setRenameTableId] = useState(null);
  const [aliasValue, setAliasValue] = useState("");

  useEffect(() => {
    loadRegions();
  }, []);

  async function loadRegions() {
    const regionsData = await getRegions();
    setRegions(regionsData);

    // İlk bölgeyi seçip masaları yükle
    if (regionsData.length > 0) {
      setSelectedRegion(regionsData[0].id);
      loadTables(regionsData[0].id);
    } else {
      setSelectedRegion(null);
      setTables([]);
    }
  }

  async function loadTables(regionId) {
    const tbl = await getTablesByRegion(regionId);
    setTables(tbl);
  }

  async function handleAddRegion() {
    if (!newRegionName.trim()) return;
    await createRegion(newRegionName);
    setNewRegionName("");
    await loadRegions();
  }

  async function handleDeleteRegion(regionId) {
    await deleteRegion(regionId);
    // Silinen bölge, seçili bölgeyse yeni bir bölge seç
    if (selectedRegion === regionId) {
      const updatedRegions = regions.filter((r) => r.id !== regionId);
      if (updatedRegions.length > 0) {
        setSelectedRegion(updatedRegions[0].id);
        loadTables(updatedRegions[0].id);
      } else {
        setSelectedRegion(null);
        setTables([]);
      }
    }
    await loadRegions();
  }

  async function handleAddTable() {
    if (!selectedRegion) return;
    await addTable(selectedRegion);
    loadTables(selectedRegion);
  }

  async function handleDeleteTable(tableId) {
    await deleteTable(tableId);
    loadTables(selectedRegion);
  }

  function handleRegionChange(e) {
    const regionId = e.target.value;
    setSelectedRegion(regionId);
    loadTables(regionId);
  }

  // MASA İSİM DEĞİŞTİR (Modal Açma)
  function openRenameModal(table) {
    setRenameTableId(table.id);
    setAliasValue(table.alias || "");
    setShowRenameModal(true);
  }
  function closeRenameModal() {
    setShowRenameModal(false);
    setRenameTableId(null);
    setAliasValue("");
  }

  // MASA İSİM DEĞİŞTİR (Kaydet)
  async function handleRenameSave() {
    if (!renameTableId) return;
    await renameTable(renameTableId, aliasValue);
    loadTables(selectedRegion);
    closeRenameModal();
  }

  return (
    <div className="p-4">
      {/* 1) Üst: Yeni Bölge Ekle */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Yeni Bölge Adı"
          value={newRegionName}
          onChange={(e) => setNewRegionName(e.target.value)}
          className="border px-2 py-1 flex-1"
        />
        <button
          onClick={handleAddRegion}
          className="px-3 py-2 bg-green-500 text-white rounded"
        >
          Bölge Ekle
        </button>
      </div>

      {/* 2) Bölgeler (yatay wrap) */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Bölgeler:</div>
        <div className="flex flex-wrap gap-3">
          {regions.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded"
            >
              <span>{r.name}</span>
              <button
                onClick={() => handleDeleteRegion(r.id)}
                className="text-sm bg-red-500 text-white px-2 py-1 rounded"
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Ayraç - Bölgeler ile Bölge Seç arasına hafif bir çizgi ya da boşluk */}
      <hr className="mb-6" />

      {/* 3) Bölge Seç + Masa Ekle */}
      <div className="flex items-center gap-3 mb-6">
        <label className="font-semibold whitespace-nowrap">Bölge Seç:</label>
        <select
          value={selectedRegion || ""}
          onChange={handleRegionChange}
          className="border p-1 flex-1"
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddTable}
          className="px-3 py-2 bg-green-300 rounded"
        >
          Masa Ekle
        </button>
      </div>

      {/* 4) Masalar (3 sütun) */}
      <div className="grid grid-cols-3 gap-3">
        {tables.map((table) => (
          <div
            key={table.id}
            className="bg-white border rounded p-3 text-center flex flex-col items-center"
          >
            <div className="font-semibold text-sm mb-2">
              {table.alias ? table.alias : `Masa ${table.tableId}`}
            </div>

            {/* İkon butonlar satırı */}
            <div className="flex justify-between w-full">
              {/* Sol: Kalem simgesi (İsim Değiştir) */}
              <button
                onClick={() => openRenameModal(table)}
                className="bg-blue-500 text-white p-2 rounded"
                title="İsim Değiştir"
              >
                {/* Heroicons pencil-alt */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 4H7a2 2 0 00-2 2v3m8-5l4 4m-6 2h2a2 2 0 012 2v3m-5-5l-4 4m5 1v2m-3 0h2"
                  />
                </svg>
              </button>

              {/* Sağ: Çöp kutusu simgesi (Sil) */}
              <button
                onClick={() => handleDeleteTable(table.id)}
                className="bg-red-500 text-white p-2 rounded"
                title="Sil"
              >
                {/* Heroicons trash */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 
                       2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 
                       1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Masa Adı Değiştir */}
      {showRenameModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-4 rounded w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Masa Adı Değiştir</h2>
            <input
              type="text"
              value={aliasValue}
              onChange={(e) => setAliasValue(e.target.value)}
              className="border p-2 w-full"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeRenameModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                İptal
              </button>
              <button
                onClick={handleRenameSave}
                className="px-4 py-2 bg-green-500 text-white rounded"
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
