'use client';
import React, { useEffect, useState } from 'react';
import { Activity, Users, Building2 } from 'lucide-react';

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

export default function BoardActivityPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/board-activity')
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
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat aktivitas...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat aktivitas: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Activity className="w-4 h-4 text-indigo-600" /> Total Aktivitas
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.totalEvents ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.fromDate} s.d. {data?.toDate}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Users className="w-4 h-4 text-emerald-600" /> Coverage Pegawai
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {data?.analysis?.coveragePercentage ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            dari {data?.analysis?.activeEmployees ?? 0} pegawai aktif
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Building2 className="w-4 h-4 text-amber-600" /> Departemen Teraktif
          </div>
          <div className="text-lg font-bold text-slate-800 truncate">
            {data?.analysis?.busiestDepartment ?? '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.analysis?.busiestEventType ?? '-'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-2">Temuan Analisis</h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-[11px] text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Per Tipe Event</h3>
          <ul className="space-y-1.5">
            {(data?.byEventType ?? []).map((row: any) => (
              <li key={row.eventType} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.eventType}</span>
                <span className="font-semibold text-slate-800">
                  {row.count} ({row.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Per Peran Pemilik</h3>
          <ul className="space-y-1.5">
            {(data?.byOwnerRole ?? []).map((row: any) => (
              <li key={row.role} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.role}</span>
                <span className="font-semibold text-slate-800">
                  {row.count} ({row.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Aktivitas Terbaru
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Ringkasan</th>
                <th className="p-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.recent ?? []).map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{row.employeeName}</td>
                  <td className="p-3">{row.departmentName}</td>
                  <td className="p-3">{row.eventType}</td>
                  <td className="p-3">{row.summary}</td>
                  <td className="p-3 text-slate-500">{String(row.occurredAt).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
