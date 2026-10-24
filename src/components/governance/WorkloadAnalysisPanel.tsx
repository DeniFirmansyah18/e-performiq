'use client';
import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2, TrendingUp, Users } from 'lucide-react';

export default function WorkloadAnalysisPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/hr/workload-summary')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat ringkasan beban kerja...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            Rata-rata Jam Kerja
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.averageHours || 0} Jam</div>
          <div className="text-xs text-slate-500 mt-1">Per pegawai / periode</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Intensitas Utilisasi
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.averageIntensity || 0}%</div>
          <div className="text-xs text-slate-500 mt-1">Standar 160 Jam/bulan</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Over-Utilized (&gt;180j)
          </div>
          <div className="text-2xl font-bold text-amber-600">{data?.overUtilizedCount || 0} Pegawai</div>
          <div className="text-xs text-slate-500 mt-1">Risiko kelelahan / burnout</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            Under-Utilized (&lt;120j)
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.underUtilizedCount || 0} Pegawai</div>
          <div className="text-xs text-slate-500 mt-1">Peluang penugasan baru</div>
        </div>
      </div>

      {/* Tabel Rincian Pegawai */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            Rincian Jam Kerja & Utilisasi per Pegawai
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Nama Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Jam Reguler</th>
                <th className="p-3">Jam Lembur</th>
                <th className="p-3">Total Jam</th>
                <th className="p-3">Intensitas</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.employees || []).slice(0, 10).map((emp: any) => (
                <tr key={emp.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{emp.fullName}</td>
                  <td className="p-3">{emp.departmentName}</td>
                  <td className="p-3">{emp.totalRegularHours} Jam</td>
                  <td className="p-3">{emp.totalOvertimeHours} Jam</td>
                  <td className="p-3 font-semibold text-slate-800">{emp.totalHours} Jam</td>
                  <td className="p-3">{emp.workloadIntensityPercentage}%</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'OVER_UTILIZED'
                          ? 'bg-amber-100 text-amber-800'
                          : emp.status === 'UNDER_UTILIZED'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {emp.status}
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
