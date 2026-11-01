'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Target,
} from 'lucide-react';

export interface RosterMember {
  employeeId: string;
  fullName: string;
  employeeCode?: string;
  position?: string;
  department?: string;
}

interface ApiKpi {
  kpi_id: string;
  kpi_title: string;
  target_value: number;
  actual_value: number;
  kpi_weight: number;
  achievement_pct: number;
  status: string;
  strategic_pillar_name?: string;
}

interface ApiIndicator {
  id: string;
  kpiId: string;
  indicatorName: string;
  unitOfMeasure: string;
  targetValue: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  aggregation: 'SUM' | 'AVG' | 'LAST' | 'MAX';
  indicatorWeight: number;
  isActive: boolean;
}

interface ActiveIndicator extends ApiIndicator {
  __pending?: boolean;
}

const DEFAULT_PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

const FREQ_LABEL: Record<ApiIndicator['frequency'], string> = {
  DAILY: 'Harian',
  WEEKLY: 'Mingguan',
  MONTHLY: 'Bulanan',
};

const AGG_LABEL: Record<ApiIndicator['aggregation'], string> = {
  SUM: 'SUM (total)',
  AVG: 'AVG (rata-rata)',
  LAST: 'LAST (terakhir)',
  MAX: 'MAX (tertinggi)',
};

/**
 * Panel pengelolaan KPI per anggota tim: indikator harian (instrumen yang diisi
 * karyawan tiap hari), penarikan realisasi harian ke nilai KPI periode, dan
 * persetujuan sasaran KPI. Semua angka berasal dari API – tidak ada nilai demo.
 */
export default function KpiIndicatorPanel({
  members,
  periodId = DEFAULT_PERIOD_ID,
}: {
  members: RosterMember[];
  periodId?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [kpis, setKpis] = useState<ApiKpi[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState<string>('');
  const [indicators, setIndicators] = useState<ApiIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    indicator_name: '',
    unit_of_measure: '%',
    target_value: '100',
    direction: 'HIGHER_BETTER' as ApiIndicator['direction'],
    frequency: 'DAILY' as ApiIndicator['frequency'],
    aggregation: 'AVG' as ApiIndicator['aggregation'],
    indicator_weight: '100',
  });

  useEffect(() => {
    if (!selectedId && members.length > 0) setSelectedId(members[0].employeeId);
  }, [members, selectedId]);

  const selectedMember = useMemo(
    () => members.find((m) => m.employeeId === selectedId) ?? null,
    [members, selectedId]
  );

  const loadKpis = useCallback(
    async (employeeId: string) => {
      setIsLoading(true);
      setMessage(null);
      try {
        const res = await fetch(
          `/api/v1/performance/individual-kpis?employee_id=${employeeId}&period_id=${periodId}`
        );
        const json = await res.json();
        const items: ApiKpi[] = res.ok ? json?.data?.items ?? [] : [];
        setKpis(items);
        setSelectedKpiId((prev) =>
          items.some((k) => k.kpi_id === prev) ? prev : items[0]?.kpi_id ?? ''
        );
        if (!res.ok) {
          setMessage({ kind: 'err', text: json?.detail || 'Gagal memuat daftar KPI.' });
        }
      } catch {
        setMessage({ kind: 'err', text: 'Gagal memuat daftar KPI (koneksi).' });
        setKpis([]);
      } finally {
        setIsLoading(false);
      }
    },
    [periodId]
  );

  const loadIndicators = useCallback(async (kpiId: string) => {
    if (!kpiId) {
      setIndicators([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/performance/kpi-indicators?kpi_id=${kpiId}`);
      const json = await res.json();
      setIndicators(res.ok ? json?.data?.items ?? [] : []);
    } catch {
      setIndicators([]);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadKpis(selectedId);
  }, [selectedId, loadKpis]);

  useEffect(() => {
    loadIndicators(selectedKpiId);
  }, [selectedKpiId, loadIndicators]);

  const selectedKpi = kpis.find((k) => k.kpi_id === selectedKpiId) ?? null;
  const activeWeight = indicators
    .filter((i) => i.isActive)
    .reduce((sum, i) => sum + Number(i.indicatorWeight), 0);

  const addIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKpiId) return;
    setBusy('add');
    setMessage(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpi_id: selectedKpiId,
          indicator_name: form.indicator_name.trim(),
          unit_of_measure: form.unit_of_measure.trim() || '%',
          target_value: Number(form.target_value),
          direction: form.direction,
          frequency: form.frequency,
          aggregation: form.aggregation,
          indicator_weight: Number(form.indicator_weight),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ kind: 'ok', text: `Indikator "${form.indicator_name.trim()}" ditetapkan.` });
        setForm((prev) => ({ ...prev, indicator_name: '', target_value: '100' }));
        await loadIndicators(selectedKpiId);
      } else {
        setMessage({ kind: 'err', text: json?.detail || 'Gagal menambah indikator.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setBusy(null);
    }
  };

  const toggleIndicator = async (ind: ApiIndicator) => {
    setBusy(ind.id);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-indicators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator_id: ind.id, is_active: !ind.isActive }),
      });
      const json = await res.json();
      if (res.ok) {
        await loadIndicators(selectedKpiId);
      } else {
        setMessage({ kind: 'err', text: json?.detail || 'Gagal mengubah indikator.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setBusy(null);
    }
  };

  const removeIndicator = async (ind: ApiIndicator) => {
    setBusy(ind.id);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/v1/performance/kpi-indicators?indicator_id=${ind.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ kind: 'ok', text: `Indikator "${ind.indicatorName}" dihapus.` });
        await loadIndicators(selectedKpiId);
      } else {
        setMessage({ kind: 'err', text: json?.detail || 'Gagal menghapus indikator.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setBusy(null);
    }
  };

  const pullRollup = async () => {
    if (!selectedId) return;
    setBusy('rollup');
    setMessage(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-rollup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selectedId, period_id: periodId }),
      });
      const json = await res.json();
      if (res.ok) {
        const data = json?.data ?? {};
        setMessage({
          kind: 'ok',
          text: `Realisasi harian ditarik: ${data.updated ?? 0} KPI diperbarui dari ${data.entries ?? 0} entri harian.`,
        });
        await loadKpis(selectedId);
      } else {
        setMessage({ kind: 'err', text: json?.detail || 'Gagal menarik realisasi harian.' });
      }
    } catch {
      setMessage({ kind: 'err', text: 'Terjadi kesalahan koneksi.' });
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    const pending = kpis.filter((k) => k.status !== 'APPROVED');
    if (pending.length === 0) {
      setMessage({ kind: 'ok', text: 'Semua KPI anggota ini sudah berstatus disetujui.' });
      return;
    }
    setBusy('approve');
    setMessage(null);
    let okCount = 0;
    const failures: string[] = [];
    for (const k of pending) {
      try {
        const res = await fetch('/api/v1/performance/individual-kpis', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kpi_id: k.kpi_id, action: 'APPROVE' }),
        });
        if (res.ok) okCount += 1;
        else {
          const json = await res.json().catch(() => ({}));
          failures.push(`${k.kpi_title}: ${json?.detail || 'gagal'}`);
        }
      } catch {
        failures.push(`${k.kpi_title}: kesalahan koneksi`);
      }
    }
    await loadKpis(selectedId);
    setBusy(null);
    setMessage(
      failures.length
        ? { kind: 'err', text: `${okCount} KPI disetujui; ${failures.length} gagal — ${failures[0]}` }
        : { kind: 'ok', text: `${okCount} sasaran KPI berhasil disahkan dan tercatat di audit trail.` }
    );
  };

  return (
    <div className="space-y-4">
      {/* Pemilih anggota */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="kpi-panel-member"
            className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1"
          >
            Anggota Tim
          </label>
          <select
            id="kpi-panel-member"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
          >
            {members.length === 0 && <option value="">Tidak ada anggota dalam cakupan</option>}
            {members.map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.fullName}
                {m.employeeCode ? ` — ${m.employeeCode}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => selectedId && loadKpis(selectedId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={pullRollup}
            disabled={busy === 'rollup' || !selectedId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-2 text-xs font-bold text-white hover:bg-[#00684a] disabled:opacity-60"
          >
            {busy === 'rollup' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Target className="h-3.5 w-3.5" />
            )}
            Tarik Realisasi Harian
          </button>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold ${
            message.kind === 'ok'
              ? 'border-[#b7e1cd] bg-[#e6f4ea] text-[#137333]'
              : 'border-[#f5c2c0] bg-[#fce8e6] text-[#c5221f]'
          }`}
        >
          {message.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat KPI…
        </p>
      ) : kpis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-center">
          <p className="text-xs font-semibold text-[#334155]">
            {selectedMember ? selectedMember.fullName : 'Anggota ini'} belum memiliki sasaran KPI pada periode ini.
          </p>
          <p className="mt-1 text-[11px] text-[#64748b]">
            KPI dapat ditetapkan lewat kontrak kinerja karyawan atau seed KPI pembuka saat onboarding.
          </p>
        </div>
      ) : (
        <>
          {/* Daftar KPI */}
          <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                <tr>
                  <th className="py-2.5 px-3">Sasaran KPI</th>
                  <th className="py-2.5 px-3 text-center">Bobot</th>
                  <th className="py-2.5 px-3 text-center">Target</th>
                  <th className="py-2.5 px-3 text-center">Realisasi</th>
                  <th className="py-2.5 px-3 text-center">Capaian</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Indikator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {kpis.map((k) => (
                  <tr
                    key={k.kpi_id}
                    className={selectedKpiId === k.kpi_id ? 'bg-[#f1f8f4]' : 'hover:bg-[#f8fafc]'}
                  >
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-[#0f172a]">{k.kpi_title}</p>
                      <p className="text-[10px] text-[#64748b]">{k.strategic_pillar_name}</p>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">{Number(k.kpi_weight)}%</td>
                    <td className="py-2.5 px-3 text-center font-mono">{Number(k.target_value)}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{Number(k.actual_value)}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#007a5a]">
                      {Number(k.achievement_pct).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          k.status === 'APPROVED'
                            ? 'bg-[#e6f4ea] text-[#137333]'
                            : 'bg-[#fff4e5] text-[#a15c00]'
                        }`}
                      >
                        {k.status === 'APPROVED' ? 'Disetujui' : 'Menunggu'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedKpiId(k.kpi_id)}
                        className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#f1f5f9]"
                      >
                        {selectedKpiId === k.kpi_id ? 'Dipilih' : 'Kelola'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={approveAll}
              disabled={busy === 'approve'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#00684a] disabled:opacity-60"
            >
              {busy === 'approve' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Setujui Semua KPI Anggota Ini
            </button>
          </div>

          {/* Indikator harian KPI terpilih */}
          {selectedKpi && (
            <div className="space-y-3 rounded-xl border border-[#e2e8f0] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0f172a]">
                    Indikator Harian — {selectedKpi.kpi_title}
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Indikator inilah yang muncul di checklist harian karyawan dan ditarik menjadi realisasi KPI.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    activeWeight > 100
                      ? 'bg-[#fce8e6] text-[#c5221f]'
                      : 'bg-[#e6f4ea] text-[#137333]'
                  }`}
                >
                  Total bobot aktif {activeWeight}%
                </span>
              </div>

              {indicators.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3 text-[11px] text-[#64748b]">
                  Belum ada indikator. Tambahkan minimal satu agar karyawan dapat mengisi capaian harian.
                </p>
              ) : (
                <ul className="divide-y divide-[#f1f5f9]">
                  {indicators.map((ind) => (
                    <li key={ind.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
                          {ind.indicatorName}
                          {!ind.isActive && (
                            <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748b]">
                              nonaktif
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-[#64748b]">
                          Target {ind.targetValue} {ind.unitOfMeasure} · bobot {ind.indicatorWeight}% ·{' '}
                          {FREQ_LABEL[ind.frequency]} · {AGG_LABEL[ind.aggregation]} ·{' '}
                          {ind.direction === 'HIGHER_BETTER' ? 'lebih tinggi lebih baik' : 'lebih rendah lebih baik'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleIndicator(ind)}
                          disabled={busy === ind.id}
                          className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#f1f5f9] disabled:opacity-60"
                        >
                          {ind.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeIndicator(ind)}
                          disabled={busy === ind.id}
                          aria-label={`Hapus indikator ${ind.indicatorName}`}
                          className="rounded-lg border border-[#f5c2c0] p-1 text-[#c5221f] hover:bg-[#fce8e6] disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={addIndicator} className="grid grid-cols-2 gap-2 border-t border-[#f1f5f9] pt-3 lg:grid-cols-12">
                <label className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-4">
                  Nama Indikator
                  <input
                    required
                    value={form.indicator_name}
                    onChange={(e) => setForm({ ...form, indicator_name: e.target.value })}
                    placeholder="cth. SLA penyelesaian tiket"
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-2">
                  Target
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.target_value}
                    onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-1">
                  Satuan
                  <input
                    value={form.unit_of_measure}
                    onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-1">
                  Bobot %
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    step="0.01"
                    value={form.indicator_weight}
                    onChange={(e) => setForm({ ...form, indicator_weight: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  />
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-2">
                  Frekuensi
                  <select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({ ...form, frequency: e.target.value as ApiIndicator['frequency'] })
                    }
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  >
                    <option value="DAILY">Harian</option>
                    <option value="WEEKLY">Mingguan</option>
                    <option value="MONTHLY">Bulanan</option>
                  </select>
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] lg:col-span-2">
                  Agregasi
                  <select
                    value={form.aggregation}
                    onChange={(e) =>
                      setForm({ ...form, aggregation: e.target.value as ApiIndicator['aggregation'] })
                    }
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-[#0f172a]"
                  >
                    <option value="AVG">AVG (rata-rata)</option>
                    <option value="SUM">SUM (total)</option>
                    <option value="LAST">LAST (terakhir)</option>
                    <option value="MAX">MAX (tertinggi)</option>
                  </select>
                </label>
                <div className="col-span-2 flex items-end lg:col-span-12">
                  <button
                    type="submit"
                    disabled={busy === 'add'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#00684a] disabled:opacity-60"
                  >
                    {busy === 'add' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Tambah Indikator
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
