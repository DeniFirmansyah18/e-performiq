'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ColumnFilterOption {
  label: string;
  value: string;
}

export interface DataTableColumnFilterProps {
  columnTitle: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: ColumnFilterOption[];
  variant?: 'popover' | 'inline';
  className?: string;
}

/**
 * Komponen Penyaring Kolom Tabel bergaya shadcn UI.
 * Mendukung mode pencarian teks bebas maupun pilihan kategori (*select*).
 */
export function DataTableColumnFilter({
  columnTitle,
  value,
  onChange,
  placeholder = 'Cari...',
  options,
  variant = 'popover',
  className,
}: DataTableColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    if (inputRef.current) inputRef.current.focus();
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const hasFilter = Boolean(value && value.trim() !== '' && value !== 'ALL');

  if (variant === 'inline') {
    return (
      <div className={cn('relative flex items-center', className)}>
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        {options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
          >
            <option value="">Semua {columnTitle}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-8 w-full pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#007a5a] focus:ring-1 focus:ring-[#007a5a]"
          />
        )}
        {hasFilter && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Hapus filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // Variant popover
  return (
    <div className={cn('relative inline-flex items-center', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'p-1 rounded-md transition-colors cursor-pointer',
          hasFilter
            ? 'bg-[#007a5a] text-white shadow-2xs'
            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        )}
        title={hasFilter ? `Filter ${columnTitle}: "${value}" aktif` : `Filter ${columnTitle}`}
      >
        <Filter className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl bg-white border border-slate-200 p-3 shadow-xl text-xs space-y-2 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="font-bold text-slate-800">Filter {columnTitle}</span>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {options ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                  !hasFilter ? 'bg-[#007a5a]/10 text-[#007a5a] font-bold' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                Semua {columnTitle}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer truncate',
                    value === opt.value
                      ? 'bg-[#007a5a]/10 text-[#007a5a] font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#007a5a]"
              />
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="absolute right-2 top-2 p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

