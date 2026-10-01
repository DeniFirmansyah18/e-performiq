'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface ActionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tag?: string;
  onClick: () => void;
  /** Variasi warna aksen untuk ikon (default hijau emerald). */
  tone?: 'emerald' | 'slate' | 'blue' | 'amber' | 'rose' | 'teal' | 'indigo' | 'violet';
  disabled?: boolean;
}

const TONES: Record<NonNullable<ActionCardProps['tone']>, { iconBg: string; iconText: string }> = {
  emerald: { iconBg: 'bg-[#e6f4ea]', iconText: 'text-[#007a5a]' },
  slate: { iconBg: 'bg-[#f1f5f9]', iconText: 'text-[#475569]' },
  blue: { iconBg: 'bg-[#e0f2fe]', iconText: 'text-[#0284c7]' },
  amber: { iconBg: 'bg-[#fef3c7]', iconText: 'text-[#b45309]' },
  rose: { iconBg: 'bg-[#fce8e6]', iconText: 'text-[#dc2626]' },
  teal: { iconBg: 'bg-[#ccfbf1]', iconText: 'text-[#0f766e]' },
  indigo: { iconBg: 'bg-[#e0e7ff]', iconText: 'text-[#4f46e5]' },
  violet: { iconBg: 'bg-[#ede9fe]', iconText: 'text-[#7c3aed]' },
};

export default function ActionCard({
  icon: Icon,
  title,
  description,
  tag,
  onClick,
  tone = 'emerald',
  disabled = false,
}: ActionCardProps) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group text-left rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#007a5a] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.iconBg}`}>
            <Icon className={`h-4 w-4 ${t.iconText}`} />
          </span>
          <div>
            <p className="text-sm font-bold text-[#0f172a] leading-tight">{title}</p>
            {tag && (
              <span className="mt-0.5 inline-block rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                {tag}
              </span>
            )}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#94a3b8] transition-colors group-hover:text-[#007a5a]" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#64748b]">{description}</p>
      <p className="mt-3 text-[11px] font-semibold text-[#007a5a] opacity-0 transition-opacity group-hover:opacity-100">
        Klik untuk membuka →
      </p>
    </button>
  );
}
