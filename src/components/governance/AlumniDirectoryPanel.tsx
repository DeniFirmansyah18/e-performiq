'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users2 } from 'lucide-react';
import ListPager from '@/components/ui/ListPager';

/**
 * Panel direktori alumni: karyawan yang sudah keluar, kelayakan dipekerjakan
 * kembali, dan izin dihubungi untuk peluang mendatang.
 */
export default function AlumniDirectoryPanel() {
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/post-employment/alumni');
      const json = await res.json();
      if (res.ok) setData(json?.data ?? null);
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const res = await fetch('/api/v1/hr/employee-directory');
        if (res.ok) {
          const json = await res.json();
          const list = json?.data?.items ?? json?.data ?? [];
          setEmployees(Array.isArray(list) ? list : []);
        }
      } catch {
        // abaikan
      }
    })();
  }, [load]);

  const addAlumni = async () => {
    if (!employeeId) return;
    setBusy('add');
    setNotice(null);
    try {
      const res = await fetch('/api/v1/post-employment/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message ?? 'Karyawan ditambahkan ke direktori alumni.');
        setEmployeeId('');
        void load();
      } else {
        setNotice(json?.detail || json?.error?.message || json?.message || 'Gagal menambah alumni.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/post-employment/alumni/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setNotice(res.ok ? json?.message ?? 'Data alumni diperbarui.' : json?.detail || json?.message || 'Gagal memperbarui alumni.');
      if (res.ok) void load();
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const rows: any[] = data?.alumni ?? [];
  const summary = data?.summary;

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <Users2 className="h-4 w-4 text-[#007a5a]" />
            <span>Direktori Alumni</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Mantan karyawan yang layak dipertimbangkan kembali untuk pengisian posisi mendatang.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-[#007a5a] bg-[#e6f4f0] px-2 py-1 rounded-lg">
              {summary.total} alumni
            </span>
            <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
              {summary.rehireEligible} layak kembali
            </span>
            <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-1 rounded-lg">
              {summary.consenting} bersedia dihubungi
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-[#0f172a] flex-1 min-w-[200px]">
          Tambahkan karyawan keluar ke alumni
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
          >
            <option value="">— Pilih karyawan —</option>
            {employees.map((emp) => {
              const id = emp.employeeId ?? emp.id;
              return (
                <option key={id} value={id}>
                  {emp.fullName ?? emp.full_name ?? emp.name}
                  {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="button"
          onClick={addAlumni}
          disabled={busy === 'add' || !employeeId}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> {busy === 'add' ? 'Menyimpan...' : 'Tambah alumni'}
        </button>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat direktori alumni...</p>
      ) : (
        <ListPager
          items={rows}
          itemKey={(a) => a.id}
          itemLabel="alumni"
          emptyMessage="Belum ada alumni terdaftar."
          searchPlaceholder="Cari nama, posisi, atau departemen..."
          searchText={(a) =>
            `${a.employeeName} ${a.lastPosition ?? ''} ${a.lastDepartment ?? ''} ${a.exitDate} ${a.contactEmail ?? ''}`
          }
          maxHeight="460px"
          renderItem={(a) => (
            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-[11px]">
                  <p className="font-bold text-[#0f172a]">
                    {a.employeeName} · {a.lastPosition || '-'}
                  </p>
                  <p className="text-[#64748b]">
                    Keluar {a.exitDate}
                    {a.lastDepartment ? ` · ${a.lastDepartment}` : ''}
                    {a.performanceRating ? ` · rating ${a.performanceRating}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => patch(a.id, { rehire_eligible: !a.rehireEligible })}
                    disabled={busy === a.id}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                      a.rehireEligible
                        ? 'bg-[#007a5a] border-[#007a5a] text-white hover:bg-[#00674c]'
                        : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    Layak kembali
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(a.id, { consent_to_contact: !a.consentToContact })}
                    disabled={busy === a.id}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                      a.consentToContact
                        ? 'bg-[#0284c7] border-[#0284c7] text-white hover:bg-[#0369a1]'
                        : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    Boleh dihubungi
                  </button>
                </div>
              </div>
              {a.contactEmail && (
                <p className="text-[10px] text-[#64748b]">
                  Kontak: {a.contactEmail}
                  {a.contactPhone ? ` · ${a.contactPhone}` : ''}
                </p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
