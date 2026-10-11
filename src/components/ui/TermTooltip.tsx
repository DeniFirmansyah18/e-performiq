'use client';

import { useState } from 'react';
import { PLAIN_TERMS, type PlainTermKey } from '@/lib/employee/plainLanguage';

/**
 * Ikon ⓘ dengan tooltip. Menampilkan istilah teknis untuk HR/auditor tanpa
 * membebani karyawan dengan jargon. Aksesibel: fokus keyboard + aria-label.
 */
export default function TermTooltip({ termKey }: { termKey: PlainTermKey }) {
  const [open, setOpen] = useState(false);
  const t = PLAIN_TERMS[termKey];

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Penjelasan ${t.plain}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#cbd5e1] text-[10px] font-bold text-[#64748b] hover:bg-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-5 z-50 w-56 -translate-x-1/2 rounded-lg border border-[#e2e8f0] bg-white p-2 text-[11px] font-normal leading-snug text-[#334155] shadow-lg"
        >
          {t.tooltip}
          <span className="mt-1 block text-[10px] italic text-[#94a3b8]">{t.technical}</span>
        </span>
      )}
    </span>
  );
}
