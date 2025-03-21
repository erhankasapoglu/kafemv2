"use client";

import React, { useEffect, useState } from "react";
import {
  getRegions,
  createRegion,
  deleteRegion,
  getTablesByRegion,
  addTable,
  deleteTable,
  // YENİ: alias güncellemek için
  renameTable,
} from "../orders/actions";

export default function TablesManagementPage() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tables, setTables] = useState([]);
  const [newRegionName, setNewRegionName] = useState("");

  // --- Modal için state'ler ---
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTableId, setRenameTableId] = useState(null);
  const [aliasValue, setAliasValue] = useState("");

  useEffect(() => {
    loadRegions();
  }, []);

  async function loadRegions() {
    const regionsData = await getRegions();
    setRegions(regionsData);

    // Varsayılan olarak ilk bölgeyi seçip masaları yükle
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
    // Eğer silinen bölge, seçili bölge ise yeni bir bölge seç
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

  // --- MASA İSİM DEĞİŞTİR: Modal Açma ---
  function openRenameModal(table) {
    setRenameTableId(table.id);
    // Mevcut alias varsa onu göster, yoksa boş
    setAliasValue(table.alias || "");
    setShowRenameModal(true);
  }

  function closeRenameModal() {
    setShowRenameModal(false);
    setRenameTableId(null);
    setAliasValue("");
  }

  // --- MASA İSİM DEĞİŞTİR: Kaydet ---
  async function handleRenameSave() {
    if (!renameTableId) return;
    // Sunucu tarafında alias güncelle
    await renameTable(renameTableId, aliasValue);
    // Masaları yeniden yükle
    loadTables(selectedRegion);
    // Modal'ı kapat
    closeRenameModal();
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Masa Yönetimi</h1>

      {/* BÖLGE EKLE */}
      <div className="mb-4">
        <label className="font-semibold mr-2">Yeni Bölge Adı:</label>
        <input
          type="text"
          value={newRegionName}
          onChange={(e) => setNewRegionName(e.target.value)}
          className="border p-1 mr-2"
        />
        <button
          onClick={handleAddRegion}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Bölge Ekle
        </button>
      </div>

      {/* BÖLGE SEÇİMİ */}
      <div className="mb-4">
        <label className="mr-2 font-semibold">Bölge Seç:</label>
        <select
          value={selectedRegion || ""}
          onChange={handleRegionChange}
          className="border p-1"
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* EKSTRA: Bölge Listeleme ve Silme Butonları */}
      <div className="mb-4">
        <h2 className="font-bold mb-2">Bölgeler</h2>
        <ul>
          {regions.map((r) => (
            <li key={r.id} className="flex items-center mb-1">
              <span className="mr-2">{r.name}</span>
              <button
                onClick={() => handleDeleteRegion(r.id)}
                className="px-2 py-1 bg-red-500 text-white rounded"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* MASA EKLE BUTONU */}
      <button
        onClick={handleAddTable}
        className="px-4 py-2 bg-green-300 rounded"
      >
        Masa Ekle
      </button>

      {/* MASALAR LİSTESİ */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        {tables.map((table) => (
          <div key={table.id} className="bg-gray-200 p-4 rounded">
            {/* Alias varsa onu göster, yoksa Masa {tableId} */}
            <div className="font-semibold">
              {table.alias ? table.alias : `Masa ${table.tableId}`}
            </div>

            {/* İsim Değiştir Butonu */}
            <button
              onClick={() => openRenameModal(table)}
              className="mt-2 bg-blue-500 text-white rounded px-2 py-1"
            >
              İsim Değiştir
            </button>

            {/* Masa Sil Butonu */}
            <button
              onClick={() => handleDeleteTable(table.id)}
              className="mt-2 bg-red-400 text-white rounded px-2 py-1"
            >
              Sil
            </button>
          </div>
        ))}
      </div>

      {/* İSİM DEĞİŞTİR (Alias) Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-4 rounded w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Masa Adı Değiştir</h2>
            <input
              type="text"
              value={aliasValue}
              onChange={(e) => setAliasValue(e.target.value)}
              className="border p-1 w-full"
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
