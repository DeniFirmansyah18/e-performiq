'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Option { label: string; sublabel?: string; value: string; code?: string | null }

interface SearchableSelectProps {
  value: string;
  onChange: (value: string, option?: Option) => void;
  placeholder?: string;
  fetchUrl: (q: string) => string;
  /** Field objek dari API yang menjadi label & value. */
  mapOptions: (rows: any[]) => Option[];
  allowFreeText?: boolean;
  className?: string;
}

/**
 * Combobox dengan pencarian server-side + debounce (untuk institusi/jurusan).
 * Kandidat tetap bisa mengetik bebas (allowFreeText) bila data tak ditemukan.
 */
export default function SearchableSelect({
  value, onChange, placeholder, fetchUrl, mapOptions, allowFreeText = true, className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const runSearch = (term: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (term.trim().length < 2) { setOptions([]); return; }
      setLoading(true);
      try {
        const res = await fetch(fetchUrl(term));
        const j = await res.json().catch(() => ({}));
        const rows = j?.data?.institutions ?? j?.data?.majors ?? [];
        setOptions(mapOptions(rows));
      } catch { setOptions([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const inputValue = value;
  const handleInput = (text: string) => {
    setQ(text); onChange(text); setOpen(true); runSearch(text);
  };

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <input
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs"
        autoComplete="off"
      />
      {open && (q.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white shadow-lg">
          {loading && <p className="px-3 py-2 text-[11px] text-[#64748b]">Mencari…</p>}
          {!loading && options.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-[#64748b]">
              {allowFreeText ? 'Tidak ditemukan — Anda tetap bisa mengetik bebas.' : 'Tidak ditemukan.'}
            </p>
          )}
          {!loading && options.map((o) => (
            <button
              key={`${o.value}-${o.code ?? ''}`}
              type="button"
              onClick={() => { onChange(o.label, o); setQ(''); setOpen(false); }}
              className="block w-full text-left px-3 py-2 hover:bg-[#f1f5f9] border-b border-[#f8fafc] last:border-0">
              <span className="text-[11px] font-semibold text-[#0f172a]">{o.label}</span>
              {o.sublabel && <span className="block text-[10px] text-[#64748b]">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
