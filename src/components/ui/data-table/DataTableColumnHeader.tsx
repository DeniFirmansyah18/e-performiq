'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumnHeaderProps {
  title: string;
  sortDirection?: SortDirection;
  onSort?: (direction: SortDirection) => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Komponen Header Kolom Tabel bergaya shadcn UI.
 * Mendukung klik langsung untuk toggle urutan serta dropdown opsi urutan.
 */
export function DataTableColumnHeader({
  title,
  sortDirection = null,
  onSort,
  className,
  children,
}: DataTableColumnHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!onSort) {
    return <div className={cn('text-xs font-bold text-slate-700', className)}>{children || title}</div>;
  }

  const toggleSort = () => {
    if (sortDirection === null) onSort('asc');
    else if (sortDirection === 'asc') onSort('desc');
    else onSort(null);
  };

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)} ref={menuRef}>
      <button
        type="button"
        onClick={toggleSort}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md text-xs font-bold transition-colors cursor-pointer select-none',
          sortDirection
            ? 'text-[#007a5a] bg-[#007a5a]/10 hover:bg-[#007a5a]/15'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
        )}
        title={`${title}: Klik untuk mengurutkan (Asc / Desc / Reset)`}
      >
        <span>{children || title}</span>
        {sortDirection === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-[#007a5a]" />
        ) : sortDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 text-[#007a5a]" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-70 group-hover:opacity-100" />
        )}
      </button>

      {/* Dropdown Menu Alternatif (klik kanan atau tombol kecil) */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[150px] rounded-lg bg-white border border-slate-200 p-1 shadow-lg text-xs animate-in fade-in-0 zoom-in-95">
          <button
            type="button"
            onClick={() => {
              onSort('asc');
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer',
              sortDirection === 'asc'
                ? 'bg-[#007a5a]/10 text-[#007a5a] font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <ArrowUp className="h-3.5 w-3.5 text-[#007a5a]" />
            <span>Urutkan A-Z / Naik</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSort('desc');
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer',
              sortDirection === 'desc'
                ? 'bg-[#007a5a]/10 text-[#007a5a] font-bold'
                : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <ArrowDown className="h-3.5 w-3.5 text-[#007a5a]" />
            <span>Urutkan Z-A / Turun</span>
          </button>
          {sortDirection !== null && (
            <button
              type="button"
              onClick={() => {
                onSort(null);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-t border-slate-100 mt-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>Bersihkan Urutan</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

