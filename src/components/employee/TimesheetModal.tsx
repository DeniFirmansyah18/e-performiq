'use client';

import React, { useState } from 'react';
import { Clock, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface TimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function TimesheetModal({ isOpen, onClose, onSuccess }: TimesheetModalProps) {
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [regularHours, setRegularHours] = useState('8');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [taskSummary, setTaskSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/performance/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDate,
          regularHours: Number(regularHours),
          overtimeHours: Number(overtimeHours),
          taskSummary,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.detail || json.message || 'Gagal menyimpan timesheet.');
        return;
      }

      onSuccess(`Timesheet tanggal ${workDate} berhasil dicatat.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Catat Timesheet & Jam Kerja</h3>
              <p className="text-[11px] text-slate-400">Kotak 1: Performance Hub (PP No. 35/2021)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Bekerja</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Reguler</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                value={regularHours}
                onChange={(e) => setRegularHours(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
              <span className="text-[10px] text-slate-400">Standar 8 Jam</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Lembur (Maks 4 Jam)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="4"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400">Sesuai PP 35/2021</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ringkasan Output & Aktivitas Kerja</label>
            <textarea
              rows={3}
              value={taskSummary}
              onChange={(e) => setTaskSummary(e.target.value)}
              placeholder="Jelaskan deliverable dan progres tugas yang diselesaikan hari ini..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Timesheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
