'use client';

import React from 'react';

/**
 * Menampilkan teks hasil AI yang memakai penanda **tebal** sebagai elemen
 * <strong>. Selain itu teks dibiarkan apa adanya agar tidak ada simbol aneh
 * yang ikut tampil.
 */
export function renderRichText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((s) => s !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#0f172a]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function RichText({ text }: { text: string }) {
  return <>{renderRichText(text)}</>;
}
