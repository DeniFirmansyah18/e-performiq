'use client';
import React, { useEffect, useState } from 'react';
import { Wallet, ShieldCheck, Clock, Receipt } from 'lucide-react';
import { formatRupiah } from '@/lib/utils/wibDate';

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

const rupiah = (value: number | null | undefined) => formatRupiah(value ?? 0);

export default function BoardCostPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchJson(`/api/v1/analytics/board-cost?page=${page}`)
      .then((json) => {
        if (active) setData(json.data);
      })
      .catch((err: Error) => {
        if (active) {
          setData(null);
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page]);

    const totalPages = Math.max(
      1,
      Math.ceil(
        (data?.employeesPagination?.total ?? 0) / (data?.employeesPagination?.pageSize ?? 50)
      )
    );

    if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat rincian biaya...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat rincian biaya: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Wallet className="w-4 h-4 text-indigo-600" /> Total Gaji Bersih (Net)
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.payroll?.latest?.totalNet)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Periode {data?.payroll?.latest?.periodCode ?? '-'}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-1">Rata-rata Biaya per Karyawan</div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.analysis?.costPerEmployee)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.sampleSize ?? 0} pegawai aktif
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Clock className="w-4 h-4 text-amber-600" /> Biaya & Jam Lembur
          </div>
          <div className="text-lg font-bold text-slate-800">{data?.overtime?.totalHours ?? 0} jam</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {rupiah(data?.overtime?.totalPay)}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Receipt className="w-4 h-4 text-emerald-600" /> Beban Operasional & Klaim
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.operational?.totalAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.analysis?.topDecileEmployeeCount
              ? `${data.analysis.topDecileEmployeeCount} pegawai teratas (${data.analysis.topDecileStaffPercentage}% staf) = ${data.analysis.topDecileCostShare}% biaya`
              : 'Belum ada rincian biaya operasional'}
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-700">
                  Daftar Rincian Gaji per Karyawan (Halaman {data?.employeesPagination?.page ?? page} dari{' '}
                  {totalPages})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Gaji Pokok</th>
                <th className="p-3">Tunjangan</th>
                <th className="p-3">Lembur</th>
                <th className="p-3">PPh 21</th>
                <th className="p-3">Gross</th>
                <th className="p-3">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="p-3">{e.departmentName}</td>
                  <td className="p-3">{rupiah(e.baseSalary)}</td>
                  <td className="p-3">{rupiah(e.fixedAllowance)}</td>
                  <td className="p-3">{rupiah(e.overtimePay)}</td>
                  <td className="p-3">{rupiah(e.pph21)}</td>
                  <td className="p-3">{rupiah(e.gross)}</td>
                  <td className="p-3 font-semibold text-slate-800">{rupiah(e.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Kepesertaan BPJS (nomor ter-masking)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">BPJS TK</th>
                <th className="p-3">BPJS Kesehatan</th>
                <th className="p-3">Kelas</th>
                <th className="p-3">Status TK</th>
                <th className="p-3">Status Kes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.bpjs?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="p-3 font-mono text-[11px]">{e.bpjsTkNumberMasked ?? '-'}</td>
                  <td className="p-3 font-mono text-[11px]">{e.bpjsKesNumberMasked ?? '-'}</td>
                  <td className="p-3">{e.bpjsKesClass ?? '-'}</td>
                  <td className="p-3">{e.bpjsTkStatus}</td>
                  <td className="p-3">{e.bpjsKesStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Biaya Operasional per Kategori</h3>
          <ul className="space-y-1.5">
            {(data?.operational?.byCategory ?? []).map((row: any) => (
              <li key={row.category} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.category}</span>
                <span className="font-semibold text-slate-800">
                  {rupiah(row.amount)} ({row.count})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Lembur per Departemen</h3>
          <ul className="space-y-1.5">
            {(data?.overtime?.byDepartment ?? []).map((row: any) => (
              <li key={row.departmentName} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 truncate pr-2">{row.departmentName}</span>
                <span className="font-semibold text-slate-800">
                  {row.hours} jam &bull; {rupiah(row.pay)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
