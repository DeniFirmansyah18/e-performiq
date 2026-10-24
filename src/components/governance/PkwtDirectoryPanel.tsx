'use client';
import React, { useState, useEffect } from 'react';
import { Search, Calendar, FileText, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function PkwtDirectoryPanel() {
  const [contractsData, setContractsData] = useState<any>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/hr/contracts-summary')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setContractsData(json.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat direktori PKWT & kontrak...</div>;
  }

  const alerts = contractsData?.alerts || [];
  const filtered = alerts.filter((item: any) => {
    const matchSearch =
      item.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.departmentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUrgency = filterUrgency === 'ALL' || item.urgency === filterUrgency;
    return matchSearch && matchUrgency;
  });

  return (
    <div className="space-y-6">
      {/* Metric Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-semibold mb-1">Total Kontrak PKWT</div>
          <div className="text-2xl font-bold text-slate-800">{contractsData?.totalPkwt || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Status kepegawaian aktif</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-amber-600 font-semibold mb-1">Jatuh Tempo &lt;60 Hari</div>
          <div className="text-2xl font-bold text-amber-600">{contractsData?.expiringIn60Days || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Pemberitahuan awal HR</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-red-600 font-semibold mb-1">Kritis &lt;30 Hari</div>
          <div className="text-2xl font-bold text-red-600">{contractsData?.expiringIn30Days || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Keputusan perpanjangan mendesak</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-600 font-semibold mb-1">Kontrak Kedaluwarsa</div>
          <div className="text-2xl font-bold text-slate-700">{contractsData?.expiredCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Memerlukan transisi/SK</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, NIK, atau departemen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {['ALL', 'CRITICAL_30', 'WARNING_60', 'EXPIRED', 'SAFE'].map((u) => (
              <button
                key={u}
                onClick={() => setFilterUrgency(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterUrgency === u
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {u === 'ALL'
                  ? 'Semua Status'
                  : u === 'CRITICAL_30'
                  ? 'Kritis <30h'
                  : u === 'WARNING_60'
                  ? 'Warning <60h'
                  : u === 'EXPIRED'
                  ? 'Kedaluwarsa'
                  : 'Aman'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabel Pegawai PKWT */}
        <div className="overflow-x-auto border-t border-slate-100 pt-3">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">NIK</th>
                <th className="p-3">Nama Pegawai</th>
                <th className="p-3">Posisi</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Akhir Kontrak</th>
                <th className="p-3">Sisa Hari</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Tidak ditemukan data pegawai PKWT dengan kriteria ini.
                  </td>
                </tr>
              ) : (
                filtered.map((item: any) => (
                  <tr key={item.employeeId} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-[11px] text-slate-500">{item.employeeCode}</td>
                    <td className="p-3 font-medium text-slate-800">{item.fullName}</td>
                    <td className="p-3">{item.positionTitle}</td>
                    <td className="p-3">{item.departmentName}</td>
                    <td className="p-3 font-medium text-slate-700">{item.contractEndDate}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.urgency === 'EXPIRED' || item.urgency === 'CRITICAL_30'
                            ? 'bg-red-100 text-red-700'
                            : item.urgency === 'WARNING_60'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.daysRemaining} Hari ({item.urgency})
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => alert(`Memproses telaah perpanjangan kontrak untuk ${item.fullName}`)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Tinjau PKWT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
