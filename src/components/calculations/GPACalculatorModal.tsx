'use client';

import React, { useState } from 'react';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import { X, Calculator, CheckCircle2, RotateCcw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GPACalculatorModal({ isOpen, onClose, onSuccess }: Props) {
  const [kpi, setKpi] = useState<number>(92.5);
  const [sop, setSop] = useState<number>(96.0);
  const [comp, setComp] = useState<number>(85.0);
  const [values, setValues] = useState<number>(90.0);
  const [potential, setPotential] = useState<number>(3.8);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const result = calculateCompositeGPA({
    kpiScore: kpi,
    sopScore: sop,
    competencyScore: comp,
    coreValuesScore: values,
    potentialScore: potential,
  });

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/v1/performance/appraisals/calculate-gpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_id: 'd0000000-0000-4000-8000-000000000001',
          employee_id: 'b0000000-0000-4000-8000-000000000004',
          kpi_actual_score: kpi,
          sop_compliance_score: sop,
          competency_gap_score: comp,
          core_values_360_score: values,
          potential_assessment_score: potential,
        }),
      });
      if (onSuccess) onSuccess();
    } catch {
      // fallback
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const handleReset = () => {
    setKpi(92.5);
    setSop(96.0);
    setComp(85.0);
    setValues(90.0);
    setPotential(3.8);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Simulasi Komposit GPA Karyawan
              </h3>
              <p className="text-xs text-slate-400">
                Formula PRD: (50% KPI) + (20% SOP) + (15% Kompetensi) + (15% 360 Values)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Real-time Calculation Result Card */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/80 border border-blue-500/30">
          <div className="text-center border-r border-slate-800">
            <span className="text-[11px] text-slate-400">Composite GPA</span>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">
              {result.compositeGPA.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Skala 4.00</span>
          </div>

          <div className="text-center border-r border-slate-800">
            <span className="text-[11px] text-slate-400">Total Skor Akhir</span>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {result.totalPercentage.toFixed(1)}%
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">
              Rating {result.rating}
            </span>
          </div>

          <div className="text-center">
            <span className="text-[11px] text-slate-400">9-Box Placement</span>
            <div className="text-xs font-bold text-purple-400 mt-2 truncate px-1">
              {result.nineBoxQuadrant.replace('_', ' ')}
            </div>
            <span className="text-[10px] text-slate-400">Talent Grid</span>
          </div>
        </div>

        {/* Interactive Sliders */}
        <div className="space-y-4">
          {/* KPI (50%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-200">
                1. Sasaran KPI Cascaded (Bobot 50%)
              </span>
              <span className="font-mono text-blue-400 font-bold">
                {kpi.toFixed(1)}% (Kontribusi: {result.breakdown.kpiWeighted.toFixed(2)} poin)
              </span>
            </div>
            <input
              type="range"
              min="40"
              max="130"
              step="0.5"
              value={kpi}
              onChange={(e) => setKpi(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* SOP Compliance (20%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-200">
                2. Kepatuhan SOP & Operational SLA (Bobot 20%)
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {sop.toFixed(1)}% (Kontribusi: {result.breakdown.sopWeighted.toFixed(2)} poin)
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="0.5"
              value={sop}
              onChange={(e) => setSop(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Competency Gap (15%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-200">
                3. Penguasaan Kompetensi / Skill Matrix (Bobot 15%)
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {comp.toFixed(1)}% (Kontribusi: {result.breakdown.competencyWeighted.toFixed(2)} poin)
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="0.5"
              value={comp}
              onChange={(e) => setComp(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Core Values 360 (15%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-200">
                4. Budaya AKHLAK & 360 Review (Bobot 15%)
              </span>
              <span className="font-mono text-purple-400 font-bold">
                {values.toFixed(1)}% (Kontribusi: {result.breakdown.coreValuesWeighted.toFixed(2)} poin)
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="0.5"
              value={values}
              onChange={(e) => setValues(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Potential Score (1-5) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Asesmen Potensi Suksesi (Skala 1.0 - 5.0)
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {potential.toFixed(1)} / 5.0
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={potential}
              onChange={(e) => setPotential(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-md shadow-blue-600/30"
            >
              <CheckCircle2 className="h-4 w-4" />
              Terapkan Hasil Simulasi
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
