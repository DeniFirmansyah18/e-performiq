'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, TrendingUp, Users, HelpCircle } from 'lucide-react';

interface EmployeeWorkload {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  entryCount: number;
  capacityHours: number;
  workloadIntensityPercentage: number;
  status: 'NO_DATA' | 'UNDER_UTILIZED' | 'OPTIMAL' | 'OVER_UTILIZED';
}

interface WorkloadSummary {
  fromDate: string | null;
  toDate: string | null;
  capacityHours: number;
  averageHours: number;
  averageIntensity: number;
  overUtilizedCount: number;
  underUtilizedCount: number;
  optimalCount: number;
  noDataCount: number;
  employees: EmployeeWorkload[];
}

const STATUS_META: Record<EmployeeWorkload['status'], { label: string; className: string }> = {
  OVER_UTILIZED: { label: 'Beban berlebih', className: 'bg-amber-100 text-amber-800' },
  OPTIMAL: { label: 'Optimal', className: 'bg-emerald-100 text-emerald-800' },
  UNDER_UTILIZED: { label: 'Kurang beban', className: 'bg-sky-100 text-sky-800' },
  NO_DATA: { label: 'Tanpa data', className: 'bg-slate-100 text-slate-600' },
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function WorkloadAnalysisPanel() {
  const [data, setData] = useState<WorkloadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmployeeWorkload['status']>('ALL');
  // Paginasi di level data: tabel & filter status tetap utuh.
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/hr/workload-summary')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
        return json;
      })
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const employees = useMemo(() => {
    const list = data?.employees ?? [];
    return statusFilter === 'ALL' ? list : list.filter((e) => e.status === statusFilter);
  }, [data, statusFilter]);

  // Pencarian + paginasi 10 baris (549 karyawan pada cakupan HR).
  const UKURAN_HALAMAN = 10;
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.fullName} ${e.employeeCode ?? ''} ${e.departmentName ?? ''}`.toLowerCase().includes(q)
    );
  }, [employees, cari]);
  const totalHalaman = Math.max(1, Math.ceil(tersaring.length / UKURAN_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const tampil = tersaring.slice((halamanAman - 1) * UKURAN_HALAMAN, halamanAman * UKURAN_HALAMAN);

  // Jendela nomor halaman: maksimal 5 tombol, mengikuti halaman aktif.
  const jendela = 5;
  const mulaiNomor = Math.max(1, Math.min(halamanAman - Math.floor(jendela / 2), totalHalaman - jendela + 1));
  const nomorHalaman = Array.from({ length: Math.min(jendela, totalHalaman) }, (_, i) => mulaiNomor + i);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat ringkasan beban kerja...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat ringkasan beban kerja: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            Rata-rata Jam Tercatat
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.averageHours ?? 0} Jam</div>
          <div className="text-xs text-slate-500 mt-1">
            Periode {formatDate(data?.fromDate ?? null)} - {formatDate(data?.toDate ?? null)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Intensitas Utilisasi
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.averageIntensity ?? 0}%</div>
          <div className="text-xs text-slate-500 mt-1">
            Terhadap kapasitas {data?.capacityHours ?? 0} jam
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Beban Berlebih
          </div>
          <div className="text-2xl font-bold text-amber-600">{data?.overUtilizedCount ?? 0} Pegawai</div>
          <div className="text-xs text-slate-500 mt-1">Risiko kelelahan / burnout</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            Kurang Beban
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.underUtilizedCount ?? 0} Pegawai</div>
          <div className="text-xs text-slate-500 mt-1">Peluang penugasan baru</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            Tanpa Data Timesheet
          </div>
          <div className="text-2xl font-bold text-slate-700">{data?.noDataCount ?? 0} Pegawai</div>
          <div className="text-xs text-slate-500 mt-1">Tidak dihitung under-utilized</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            Rincian Jam Kerja & Utilisasi per Pegawai
          </h3>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'OVER_UTILIZED', 'OPTIMAL', 'UNDER_UTILIZED', 'NO_DATA'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'ALL' ? 'Semua' : STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Pencarian di dalam kartu, dengan padding & garis pemisah. */}
        <div className="px-4 py-3 border-b border-slate-100">
          <input
            type="search"
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder={`Cari dari ${employees.length} pegawai (nama / NIK / unit)...`}
            aria-label="Cari pegawai"
            className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]/30"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Nama Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Hari Tercatat</th>
                <th className="p-3">Jam Reguler</th>
                <th className="p-3">Jam Lembur</th>
                <th className="p-3">Total Jam</th>
                <th className="p-3">Intensitas</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tersaring.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    {cari ? 'Tidak ada pegawai yang cocok dengan pencarian.' : 'Tidak ada pegawai dengan status ini.'}
                  </td>
                </tr>
              ) : (
                tampil.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">
                      {emp.fullName}
                      <span className="ml-2 font-mono text-[10px] text-slate-400">{emp.employeeCode}</span>
                    </td>
                    <td className="p-3">{emp.departmentName}</td>
                    <td className="p-3">{emp.entryCount}</td>
                    <td className="p-3">{emp.totalRegularHours} Jam</td>
                    <td className="p-3">{emp.totalOvertimeHours} Jam</td>
                    <td className="p-3 font-semibold text-slate-800">{emp.totalHours} Jam</td>
                    <td className="p-3">{emp.workloadIntensityPercentage}%</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_META[emp.status].className}`}
                      >
                        {STATUS_META[emp.status].label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
          </tbody>
          </table>
        </div>

        {/* Navigasi halaman: padding di dalam kartu, nomor halaman maksimal 5. */}
        {tersaring.length > UKURAN_HALAMAN && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b]">
            <span>
              {tersaring.length === 0
                ? '0 pegawai'
                : `Menampilkan ${(halamanAman - 1) * UKURAN_HALAMAN + 1}–${Math.min(halamanAman * UKURAN_HALAMAN, tersaring.length)} dari ${tersaring.length} pegawai`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHalaman(halamanAman - 1)}
                disabled={halamanAman <= 1}
                aria-label="Halaman sebelumnya"
                className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
              >
                Sebelumnya
              </button>
              {nomorHalaman.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHalaman(n)}
                  aria-label={`Halaman ${n}`}
                  aria-current={n === halamanAman ? 'page' : undefined}
                  className={`min-w-[26px] h-[26px] rounded-lg border text-[11px] font-semibold transition-colors ${
                    n === halamanAman
                      ? 'bg-[#007a5a] border-[#007a5a] text-white'
                      : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="font-semibold text-[#334155] ml-0.5">
                Halaman {halamanAman} / {totalHalaman}
              </span>
              <button
                type="button"
                onClick={() => setHalaman(halamanAman + 1)}
                disabled={halamanAman >= totalHalaman}
                aria-label="Halaman berikutnya"
                className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
