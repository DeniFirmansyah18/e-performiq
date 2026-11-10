'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileSignature, Stamp } from 'lucide-react';
import ListPager from '@/components/ui/ListPager';

/** Panel penerbitan surat keterangan kerja (paklaring) dan verifikasinya. */
const LETTER_TYPES = [
  { value: 'EMPLOYMENT', label: 'Surat Keterangan Kerja' },
  { value: 'SALARY', label: 'Surat Keterangan Penghasilan' },
  { value: 'EXPERIENCE', label: 'Surat Pengalaman Kerja' },
  { value: 'REFERENCE', label: 'Surat Referensi' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ServiceLetterPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState({
    employee_id: '',
    letter_type: 'EMPLOYMENT_REFERENCE',
    issue_date: todayIso(),
    purpose: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/post-employment/service-letters');
      const json = await res.json();
      if (res.ok) setLetters(json?.data?.items ?? []);
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

  const issue = async () => {
    setSaving(true);
    setNotice(null);
    setPreview(null);
    try {
      const res = await fetch('/api/v1/post-employment/service-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          letter_type: form.letter_type,
          issue_date: form.issue_date,
          purpose: form.purpose || null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message ?? 'Surat berhasil diterbitkan.');
        setPreview(json?.data ?? null);
        setForm({ ...form, employee_id: '', purpose: '', notes: '' });
        void load();
      } else {
        setNotice(json?.detail || json?.error?.message || json?.message || 'Gagal menerbitkan surat.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-[#007a5a]" />
          <span>Surat Keterangan Kerja</span>
        </h3>
        <p className="text-[11px] text-[#64748b]">
          Terbitkan paklaring bernomor unik yang bisa diverifikasi pihak luar.
        </p>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#0f172a]">
            Karyawan
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
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
          <label className="text-[11px] font-semibold text-[#0f172a]">
            Jenis surat
            <select
              value={form.letter_type}
              onChange={(e) => setForm({ ...form, letter_type: e.target.value })}
              className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
            >
              {LETTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#0f172a]">
            Tanggal terbit
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
            />
          </label>
          <label className="text-[11px] font-semibold text-[#0f172a]">
            Keperluan
            <input
              type="text"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="mis. pengajuan kredit bank"
              className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={issue}
            disabled={saving || !form.employee_id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold disabled:opacity-50"
          >
            <Stamp className="h-3.5 w-3.5" /> {saving ? 'Menerbitkan...' : 'Terbitkan surat'}
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {preview?.verificationCode && (
        <div className="rounded-xl border border-[#007a5a] bg-[#e6f4f0] p-3">
          <p className="text-[11px] font-bold text-[#0f172a]">
            Kode verifikasi: {preview.verificationCode}
          </p>
          <p className="text-[11px] text-[#334155] mt-1">
            Bagikan kode ini agar surat bisa diperiksa keasliannya.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-[#0f172a]">Surat terbit ({letters.length})</p>
        {loading ? (
          <p className="text-[11px] text-[#64748b]">Memuat daftar surat...</p>
        ) : (
          <ListPager
            items={letters}
            itemKey={(l) => l.id}
            itemLabel="surat"
            emptyMessage="Belum ada surat yang diterbitkan."
            searchPlaceholder="Cari nama pegawai, jenis surat, atau nomor..."
            searchText={(l) =>
              `${l.letterTypeLabel} ${l.employeeName} ${l.letterNumber} ${l.verificationCode ?? ''} ${l.purpose ?? ''}`
            }
            maxHeight="440px"
            renderItem={(l) => (
              <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[11px]">
                <p className="font-bold text-[#0f172a]">
                  {l.letterTypeLabel} · {l.employeeName}
                </p>
                <p className="text-[#64748b]">
                  Nomor {l.letterNumber} · terbit {l.issuedDate}
                  {l.verificationCode ? ` · kode ${l.verificationCode}` : ''}
                  {l.purpose ? ` · ${l.purpose}` : ''}
                </p>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
