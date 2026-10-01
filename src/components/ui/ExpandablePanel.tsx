'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface ExpandablePanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ExpandablePanel({ open, title, onClose, children }: ExpandablePanelProps) {
  if (!open) return null;

  return (
    <section
      role="region"
      aria-label={title}
      className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm animate-fadeIn"
    >
      <header className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <h2 className="text-sm font-bold text-[#0f172a]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel"
          className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
