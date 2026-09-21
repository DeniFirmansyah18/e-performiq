'use client';

import React from 'react';

export default function GaussianCurve() {
  // Gaussian bell curve distributions
  // Rating D: 5% (Target <= 5%)
  // Rating C: 20% (Target 15-20%)
  // Rating B: 55% (Target 50-60%)
  // Rating A: 20% (Target <= 20%)

  const ratings = [
    { label: 'Rating D (Unsatisfactory)', range: '< 70%', actual: 4.2, target: 5.0, color: 'text-rose-400', bg: 'bg-rose-500' },
    { label: 'Rating C (Acceptable)', range: '70% - 79.9%', actual: 16.8, target: 20.0, color: 'text-amber-400', bg: 'bg-amber-500' },
    { label: 'Rating B (Solid/Meets)', range: '80% - 89.9%', actual: 58.5, target: 55.0, color: 'text-blue-400', bg: 'bg-blue-500' },
    { label: 'Rating A (Exceptional)', range: '>= 90%', actual: 20.5, target: 20.0, color: 'text-emerald-400', bg: 'bg-emerald-500' },
  ];

  return (
    <div className="w-full space-y-4">
      {/* SVG Bell Curve */}
      <div className="relative w-full h-36 bg-slate-950/40 rounded-xl border border-slate-800/80 p-3 flex flex-col justify-end">
        <svg viewBox="0 0 500 120" className="w-full h-28 overflow-visible">
          {/* Shaded Bell Curve Regions */}
          <defs>
            <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Bell Curve Path */}
          <path
            d="M 10 110 Q 120 110, 180 80 T 250 15 T 320 80 Q 380 110, 490 110"
            fill="url(#bellGrad)"
            stroke="#3b82f6"
            strokeWidth="2.5"
          />

          {/* Threshold Divider Lines */}
          {/* D / C */}
          <line x1="140" y1="20" x2="140" y2="110" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3 3" className="opacity-60" />
          {/* C / B */}
          <line x1="210" y1="15" x2="210" y2="110" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" className="opacity-60" />
          {/* B / A */}
          <line x1="360" y1="20" x2="360" y2="110" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" className="opacity-60" />

          {/* Labels inside SVG */}
          <text x="75" y="100" fill="#f43f5e" fontSize="10" fontWeight="bold">D (4.2%)</text>
          <text x="175" y="70" fill="#f59e0b" fontSize="10" fontWeight="bold">C (16.8%)</text>
          <text x="285" y="35" fill="#60a5fa" fontSize="12" fontWeight="bold">B (58.5%)</text>
          <text x="410" y="70" fill="#10b981" fontSize="10" fontWeight="bold">A (20.5%)</text>
        </svg>

        {/* Status notice */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
          <span>&larr; Deviasi Bawah</span>
          <span className="text-emerald-400 font-medium">Distribusi Normal Kalibrasi Terpenuhi (No Grade Inflation)</span>
          <span>Deviasi Atas &rarr;</span>
        </div>
      </div>

      {/* Progress Bars Comparison Table */}
      <div className="space-y-2">
        {ratings.map((r, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-none">
            <div className="flex items-center gap-2 w-48">
              <span className={`h-2 w-2 rounded-full ${r.bg}`} />
              <span className={`font-semibold ${r.color}`}>{r.label}</span>
            </div>
            <span className="text-slate-400 text-[11px] w-24 text-right">{r.range}</span>
            <div className="flex-1 mx-4 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${r.bg}`}
                style={{ width: `${(r.actual / 70) * 100}%` }}
              />
            </div>
            <div className="w-24 text-right font-mono">
              <span className="text-slate-200 font-bold">{r.actual}%</span>
              <span className="text-slate-400 text-[10px]"> / {r.target}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
