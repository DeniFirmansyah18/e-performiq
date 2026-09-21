'use client';

import React, { useState } from 'react';

interface PerspectiveData {
  label: string;
  key: string;
  actual: number;
  target: number;
  driver: string;
}

export default function RadarChartBSC() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data: PerspectiveData[] = [
    { label: 'Finansial', key: 'financial', actual: 92.4, target: 100, driver: 'Efisiensi Anggaran & MPP Adherence' },
    { label: 'Customer / Stakeholder', key: 'customer', actual: 87.1, target: 100, driver: 'Internal CSAT & Onboarding Index' },
    { label: 'Proses Internal', key: 'internal', actual: 94.8, target: 100, driver: 'Zero Fatal SOP Error & SLA Speed' },
    { label: 'Pembelajaran & Pertumbuhan', key: 'learning', actual: 83.3, target: 100, driver: '24 Jam Pelatihan & Retensi Top Talent' },
  ];

  const size = 320;
  const center = size / 2;
  const radius = 100;

  // Compute 4 points (Diamond/Square Radar): Top (Financial), Right (Customer), Bottom (Internal), Left (Learning)
  const getCoordinates = (value: number, index: number, max: number = 100) => {
    const angle = (Math.PI / 2) * index - Math.PI / 2;
    const r = (value / max) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const actualPoints = data.map((d, i) => getCoordinates(d.actual, i)).map((p) => `${p.x},${p.y}`).join(' ');
  const targetPoints = data.map((d, i) => getCoordinates(d.target, i)).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
          {/* Background circles / grid webs */}
          {[0.25, 0.5, 0.75, 1.0].map((level, idx) => {
            const levelPoints = [0, 1, 2, 3]
              .map((i) => getCoordinates(level * 100, i))
              .map((p) => `${p.x},${p.y}`)
              .join(' ');
            return (
              <polygon
                key={idx}
                points={levelPoints}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray={level === 1 ? 'none' : '3 3'}
                className="opacity-50"
              />
            );
          })}

          {/* Cross Axes lines */}
          <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#334155" strokeWidth="1" />
          <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#334155" strokeWidth="1" />

          {/* Target Benchmark (100%) - Dashed outline */}
          <polygon
            points={targetPoints}
            fill="rgba(59, 130, 246, 0.05)"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="opacity-70"
          />

          {/* Actual Achievement Polygon */}
          <polygon
            points={actualPoints}
            fill="url(#radarGradient)"
            stroke="#10b981"
            strokeWidth="2.5"
            className="transition-all duration-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Interactive Data Dots & Labels */}
          {data.map((d, i) => {
            const coord = getCoordinates(d.actual, i);
            const labelCoord = getCoordinates(125, i);
            const isHovered = hoveredIdx === i;

            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={isHovered ? 7 : 5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
                {/* Text Label */}
                <text
                  x={labelCoord.x}
                  y={labelCoord.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`text-[11px] font-semibold transition-colors ${
                    isHovered ? 'fill-emerald-400 font-bold' : 'fill-slate-300'
                  }`}
                >
                  {d.label}
                </text>
                <text
                  x={labelCoord.x}
                  y={labelCoord.y + 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-mono fill-emerald-400 font-bold"
                >
                  {d.actual}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dynamic Key Driver Tooltip below chart */}
      <div className="mt-2 min-h-[42px] text-center w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800">
        {hoveredIdx !== null ? (
          <p className="text-xs text-slate-200">
            <span className="font-bold text-emerald-400">{data[hoveredIdx].label}:</span> {data[hoveredIdx].driver} ({data[hoveredIdx].actual}%)
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Arahkan kursor ke titik radar untuk melihat detail pilar sasaran Balanced Scorecard.
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-slate-300">Realisasi 2026-Q3</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-4 border-t-2 border-dashed border-blue-400" />
          <span className="text-slate-400">Target Standard (100%)</span>
        </div>
      </div>
    </div>
  );
}
