'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface FeatureCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  metric?: string;
  tag?: string;
  onOpen: () => void;
}

export default function FeatureCard({ icon: Icon, title, description, metric, tag, onOpen }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#007a5a] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f4ea]">
              <Icon className="h-4 w-4 text-[#007a5a]" />
            </span>
          )}
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

      {metric && <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#0f172a]">{metric}</p>}
      <p className="mt-2 text-xs leading-relaxed text-[#64748b]">{description}</p>
      <p className="mt-3 text-[11px] font-semibold text-[#007a5a] opacity-0 transition-opacity group-hover:opacity-100">
        Klik untuk membuka →
      </p>
    </button>
  );
}
