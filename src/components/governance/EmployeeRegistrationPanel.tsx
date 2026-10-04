'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, CheckCircle2, XCircle } from 'lucide-react';

interface PendingRow {
  id: string;
  email: string;
  fullName: string;
  positionHint?: string | null;
  status: 'PENDING_EMAIL' | 'PENDING_APPROVAL' | string;
  createdAt: string;
}

interface Ref {
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; departmentId: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_EMAIL: 'Menunggu verifikasi email',
  PENDING_APPROVAL: 'Menunggu persetujuan HR',
};

/** Panel HR: setujui/tolak registrasi karyawan mandiri (email sudah diverifikasi → buat akun). */
export default function EmployeeRegistrationPanel() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [ref, setRef] = useState<Ref | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState('');
  const [posId, setPosId] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, reference] = await Promise.all([
        fetch('/api/v1/hr/registrations').then((x) => (x.ok ? x.json() : null)),
        fetch('/api/v1/recruitment/job-postings?reference=1').then((x) => (x.ok ? x.json() : null)),
      ]);
      if (!r) {
        setErr('Anda tidak berwenang melihat registrasi karyawan.');
        return;
      }
      setRows(r?.data?.items ?? []);
      setRef(reference?.data ?? null);
    } catch {
      setErr('Gagal memuat registrasi karyawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const positionsForDept = useMemo(() => {
    if (!ref) return [];
    if (!deptId) return ref.positions ?? [];
    return (ref.positions ?? []).filter((p) => p.departmentId === deptId);
  }, [ref, deptId]);

  const openApprove = (id: string) => {
    setApproveId(id);
    setRejectId(null);
    setMsg(null);
    setDeptId('');
    setPosId('');
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setApproveId(null);
    setMsg(null);
    setReason('');
  };

  const submitApprove = async (id: string) => {
    if (!deptId || !posId) {
      setMsg('Pilih departemen dan posisi terlebih dahulu.');
      return;
    }
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/hr/registrations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId, positionId: posId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg('Registrasi disetujui. Akun karyawan aktif.');
        setApproveId(null);
        await load();
      } else {
        setMsg(j?.detail || 'Gagal menyetujui registrasi.');
      }
    } catch {
      setMsg('Gagal menghubungi server.');
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async (id: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/hr/registrations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg('Registrasi ditolak.');
        setRejectId(null);
        await load();
      } else {
        setMsg(j?.detail || 'Gagal menolak registrasi.');
      }
    } catch {
      setMsg('Gagal menghubungi server.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <h2 className="text-base font-extrabold text-[#0f172a] flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#007a5a]" />
          Registrasi Karyawan Mandiri
        </h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333]">
          {rows.length} menunggu
        </span>
      </div>

      {msg && (
        <p className="text-xs rounded-lg border border-[#a7d7b5] bg-[#e6f4ea] text-[#137333] px-3 py-2">{msg}</p>
      )}

      {err ? (
        <p className="text-xs text-[#64748b]">{err}</p>
      ) : loading ? (
        <p className="text-xs text-[#64748b]">Memuat registrasi…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#64748b] border border-dashed border-[#cbd5e1] rounded-xl p-4 text-center">
          Tidak ada registrasi menunggu. Pendaftar baru via <span className="font-semibold">/employee/register</span> akan muncul di sini setelah verifikasi email.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#64748b] border-b border-[#f1f5f9]">
                <th className="py-2 pr-3 font-semibold">Nama</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Posisi diminati</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-[#f8fafc]">
                    <td className="py-2 pr-3 font-semibold text-[#0f172a]">{r.fullName}</td>
                    <td className="py-2 pr-3 text-[#334155]">{r.email}</td>
                    <td className="py-2 pr-3 text-[#64748b]">{r.positionHint || '–'}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${r.status === 'PENDING_APPROVAL' ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'bg-[#fef9c3] text-[#854d0e]'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {r.status === 'PENDING_APPROVAL' ? (
                        <>
                          <button
                            onClick={() => openApprove(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#007a5a] text-white font-semibold hover:bg-[#00684a] mr-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Setujui
                          </button>
                          <button
                            onClick={() => openReject(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#f5c2c7] text-[#c5221f] font-semibold hover:bg-[#fce8e6]"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Tolak
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#94a3b8]">Menunggu verifikasi email</span>
                      )}
                    </td>
                  </tr>
                  {approveId === r.id && (
                    <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                      <td colSpan={5} className="py-3 px-3">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-[#334155] mb-1">Departemen</label>
                            <select
                              value={deptId}
                              onChange={(e) => { setDeptId(e.target.value); setPosId(''); }}
                              className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white"
                            >
                              <option value="">— Pilih —</option>
                              {(ref?.departments ?? []).map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-[#334155] mb-1">Posisi</label>
                            <select
                              value={posId}
                              onChange={(e) => setPosId(e.target.value)}
                              className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white"
                            >
                              <option value="">— Pilih —</option>
                              {positionsForDept.map((p) => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitApprove(r.id)}
                              disabled={busyId === r.id}
                              className="px-3 py-2 rounded-lg bg-[#007a5a] text-white text-xs font-semibold hover:bg-[#00684a] disabled:opacity-50"
                            >
                              {busyId === r.id ? 'Memproses…' : 'Konfirmasi'}
                            </button>
                            <button
                              onClick={() => setApproveId(null)}
                              className="px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#64748b]"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {rejectId === r.id && (
                    <tr className="border-b border-[#f1f5f9] bg-[#fef2f2]">
                      <td colSpan={5} className="py-3 px-3">
                        <label className="block text-[11px] font-semibold text-[#334155] mb-1">Alasan penolakan (opsional)</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="cth. Data tidak valid"
                            maxLength={1000}
                            className="flex-1 px-2.5 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitReject(r.id)}
                              disabled={busyId === r.id}
                              className="px-3 py-2 rounded-lg bg-[#c5221f] text-white text-xs font-semibold hover:bg-[#a51c1a] disabled:opacity-50"
                            >
                              {busyId === r.id ? 'Memproses…' : 'Tolak'}
                            </button>
                            <button
                              onClick={() => setRejectId(null)}
                              className="px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#64748b] bg-white"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
