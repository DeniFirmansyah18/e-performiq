'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface CandidateRow {
  id: string; applicationNo: string; status: string; appliedAt: string;
  fullName: string; email: string; education?: string; resumeUrl?: string; postingTitle: string;
}

const STATUSES = ['SUBMITTED', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'];

/** Panel Rekrutmen Kandidat (HR): daftar pelamar eksternal + ubah status. */
export default function RecruitmentPanel() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recruitment/candidates');
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang melihat data pelamar.' : 'Gagal memuat data pelamar.');
        return;
      }
      const json = await res.json();
      setRows(json.data.candidates ?? []);
    } catch {
      setErr('Gagal memuat data pelamar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id: string, status: string) => {
    setMsg(null);
    const res = await fetch(`/api/v1/recruitment/candidates/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) { setMsg('Status diperbarui.'); await load(); }
    else setMsg('Gagal memperbarui status.');
  };

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <h2 className="text-base font-extrabold text-[#0f172a]">Rekrutmen Kandidat</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8]">Portal Karier</span>
      </div>
      {err ? (
        <p className="text-xs text-[#64748b]">{err}</p>
      ) : loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada pelamar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#64748b] border-b border-[#e2e8f0]">
                <th className="py-2">No. Lamaran</th>
                <th className="py-2">Nama</th>
                <th className="py-2">Posisi</th>
                <th className="py-2">CV</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9]">
                  <td className="py-2 font-mono text-[10px]">{r.applicationNo}</td>
                  <td className="py-2">
                    <p className="font-bold text-[#0f172a]">{r.fullName}</p>
                    <span className="text-[10px] text-[#64748b]">{r.email}</span>
                  </td>
                  <td className="py-2">{r.postingTitle}</td>
                  <td className="py-2">
                    {r.resumeUrl ? (
                      <a href={r.resumeUrl} target="_blank" rel="noreferrer" className="text-[#0284c7] underline">Lihat CV</a>
                    ) : <span className="text-[#94a3b8]">-</span>}
                  </td>
                  <td className="py-2">
                    <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)}
                      className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px]">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {msg && <p className="text-[11px] font-semibold text-[#137333] mt-2">{msg}</p>}
        </div>
      )}
    </div>
  );
}
