'use client';

import DataTable from '@/components/ui/DataTable';
import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  // Envelope tak terduga (mis. 200 tapi bukan JSON sukses) juga kegagalan:
  // menampilkan 0 akan membuat BOD membaca angka yang tidak pernah diukur.
  if (json?.status !== 'success' || !json?.data) {
    throw new Error(json?.detail ?? json?.message ?? 'Respons data tidak dikenali');
  }
  return json;
}

const FIT_CLASS: Record<string, string> = {
  COMPLIANT: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  NOT_COMPLIANT: 'bg-red-100 text-red-700',
  NO_TEMPLATE: 'bg-slate-100 text-slate-600',
};

const FIT_LABEL: Record<string, string> = {
  COMPLIANT: 'Sesuai Kriteria',
  PARTIAL: 'Perlu Pembinaan',
  NOT_COMPLIANT: 'Belum Memenuhi',
  NO_TEMPLATE: 'Belum Ada Standar',
};

export default function BoardPositionFitPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/position-fit')
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

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat kesesuaian posisi...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat kesesuaian posisi: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> Temuan Analisis
          {data?.periodCode && (
            <span className="text-[10px] font-normal text-slate-500">
              periode {data.periodCode}
            </span>
          )}
        </h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-[11px] text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Kesesuaian Jabatan Struktural
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Posisi Jabatan</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Jumlah Pejabat</th>
                <th className="p-3">Pejabat Sesuai</th>
                <th className="p-3">Standar KPI</th>
                <th className="p-3">Cakupan</th>
                <th className="p-3">Capaian</th>
                <th className="p-3">Status Kepatuhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.byPosition ?? []).map((p: any) => (
                <tr key={p.positionId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{p.positionTitle}</td>
                  <td className="p-3">{p.jobGrade ?? '-'}</td>
                  <td className="p-3">{p.holders}</td>
                  <td className="p-3">{p.compliantHolders}</td>
                  <td className="p-3">{p.templateKpiCount}</td>
                  <td className="p-3">{p.coveragePercentage}%</td>
                  <td className="p-3">{p.achievementPercentage}%</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        FIT_CLASS[p.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {FIT_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Daftar Evaluasi Karyawan per Jabatan
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Nama Pegawai</th>
                <th className="p-3">Posisi</th>
                <th className="p-3">KPI Cocok</th>
                <th className="p-3">Cakupan</th>
                <th className="p-3">Capaian</th>
                <th className="p-3">GPA</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">
                    {e.fullName}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">{e.employeeCode}</span>
                  </td>
                  <td className="p-3">{e.positionTitle}</td>
                  <td className="p-3">
                    {e.matchedKpiCount}/{e.templateKpiCount}
                  </td>
                  <td className="p-3">{e.coveragePercentage}%</td>
                  <td className="p-3">{e.achievementPercentage}%</td>
                  <td className="p-3">{e.latestGpa ?? '-'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        FIT_CLASS[e.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {FIT_LABEL[e.status] ?? e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
