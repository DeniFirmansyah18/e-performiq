'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Tabel data bersama: pencarian, paginasi, dan scroll vertikal.
 *
 * Alasan dibuat: banyak panel menampilkan daftar panjang ke bawah sehingga
 * halaman sulit dipakai. Komponen ini membatasi jumlah baris per halaman
 * (default 10), menyediakan kotak pencarian, dan mengurung tinggi tabel agar
 * bisa digulir tanpa memanjangkan halaman.
 *
 * Paginasi dilakukan di klien (data sudah dimuat ke komponen pemanggil).
 * Batasan yang disadari: beban jaringan tidak berkurang; untuk dataset besar
 * kelak perlu paginasi di sisi server.
 */
export interface DataTableColumn<T> {
  /** Kunci unik kolom. */
  key: string;
  /** Judul kolom yang tampil di `<th>`. */
  header: string;
  /** Nilai yang dipakai pencarian dan render default. */
  value: (row: T) => string | number | null | undefined;
  /** Render kustom sel (opsional). Default: nilai `value`. */
  render?: (row: T) => React.ReactNode;
  /** Kelas tambahan untuk `<th>` dan `<td>` (mis. `text-right`). */
  className?: string;
}

export interface DataTableProps<T> {
  /** Data lengkap (belum dipotong). */
  rows: T[];
  columns: DataTableColumn<T>[];
  /** Kunci unik tiap baris. */
  rowKey: (row: T) => string;
  /** Placeholder kotak pencarian; kosongkan untuk menyembunyikan pencarian. */
  searchPlaceholder?: string;
  /** Nilai awal kotak pencarian. */
  initialSearch?: string;
  /** Jumlah baris per halaman (default 10). */
  pageSize?: number;
  /** Tinggi maksimum area gulir (default 420px). */
  maxHeight?: string;
  /** Pesan saat tidak ada baris. */
  emptyMessage?: string;
  /** Label satuan baris, mis. "karyawan". */
  itemLabel?: string;
}

export function matchesSearch<T>(row: T, columns: DataTableColumn<T>[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return columns.some((col) => {
    const v = col.value(row);
    return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
  });
}

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder,
  initialSearch,
  pageSize = 10,
  maxHeight = '420px',
  emptyMessage = 'Tidak ada data.',
  itemLabel = 'data',
}: DataTableProps<T>) {
  const [query, setQuery] = useState(initialSearch ?? '');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, columns, query)),
    [rows, columns, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const onSearch = (v: string) => {
    setQuery(v);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {searchPlaceholder && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748b]" />
          <input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]/30"
          />
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto rounded-xl border border-[#e2e8f0]" style={{ maxHeight }}>
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="sticky top-0 z-10 bg-[#f8fafc]">
            <tr className="border-b border-[#e2e8f0] text-[10px] uppercase tracking-wider text-[#64748b]">
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2.5 font-bold ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-[#64748b]">
                  {query ? `Tidak ada ${itemLabel} yang cocok dengan pencarian.` : emptyMessage}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-[#f8fafc]">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2.5 ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : (col.value(row) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b]">
        <span>
          {filtered.length === 0
            ? `0 ${itemLabel}`
            : `Menampilkan ${start + 1}–${Math.min(start + pageSize, filtered.length)} dari ${filtered.length} ${itemLabel}`}
        </span>
        {filtered.length > pageSize && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Halaman sebelumnya"
              className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-semibold text-[#334155]">
              Halaman {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Halaman berikutnya"
              className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
