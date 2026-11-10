'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Penampung daftar untuk komponen yang merender kartu/baris <div>, bukan tabel.
 *
 * `DataTable` dipakai bila markup-nya tabel HTML; `ListPager` dipakai bila
 * markup-nya kartu. Keduanya memberi perilaku sama: potong 10 baris, pencarian,
 * scroll, dan navigasi halaman — tanpa memaksa struktur markup tertentu.
 *
 * Paginasi di klien: data sudah dimuat oleh komponen pemanggil.
 */
export interface ListPagerProps<T> {
  /** Data lengkap (belum dipotong). */
  items: T[];
  /** Kunci unik tiap baris. */
  itemKey: (item: T) => string;
  /** Render satu baris/kartu. */
  renderItem: (item: T) => React.ReactNode;
  /** Teks yang dipakai pencarian untuk tiap baris (digabung lalu dicocokkan). */
  searchText: (item: T) => string;
  /** Placeholder kotak pencarian; kosongkan untuk menyembunyikan pencarian. */
  searchPlaceholder?: string;
  /** Jumlah baris per halaman (default 10). */
  pageSize?: number;
  /** Tinggi maksimum area gulir (default 420px). */
  maxHeight?: string;
  /** Label satuan, mis. "alumni". */
  itemLabel?: string;
  /** Pesan saat tidak ada data sama sekali. */
  emptyMessage?: string;
}

export function matchesText(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export default function ListPager<T>({
  items,
  itemKey,
  renderItem,
  searchText,
  searchPlaceholder,
  pageSize = 10,
  maxHeight = '420px',
  itemLabel = 'data',
  emptyMessage = 'Belum ada data.',
}: ListPagerProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => items.filter((it) => matchesText(searchText(it), query)),
    [items, searchText, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const onSearch = (v: string) => {
    setQuery(v);
    setPage(1);
  };

  // Data terlalu sedikit: tidak perlu kotak pencarian maupun paginasi.
  const perluKontrol = items.length > pageSize;

  return (
    <div className="space-y-3">
      {searchPlaceholder && perluKontrol && (
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

      <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#64748b]">
            {query ? `Tidak ada ${itemLabel} yang cocok dengan pencarian.` : emptyMessage}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((it) => (
              <div key={itemKey(it)}>{renderItem(it)}</div>
            ))}
          </div>
        )}
      </div>

      {perluKontrol && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b]">
          <span>
            {filtered.length === 0
              ? `0 ${itemLabel}`
              : `Menampilkan ${start + 1}–${Math.min(start + pageSize, filtered.length)} dari ${filtered.length} ${itemLabel}`}
          </span>
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
        </div>
      )}
    </div>
  );
}
