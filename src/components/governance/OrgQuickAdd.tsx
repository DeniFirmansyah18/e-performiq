'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  kind: 'department' | 'position';
  /** Wajib untuk kind="position". */
  departmentId?: string;
  disabled?: boolean;
  onCreated: (item: { id: string; name: string }) => void | Promise<void>;
}

/**
 * Tombol kecil untuk menambah departemen/posisi baru langsung dari form
 * (MPP / Buat Lowongan) tanpa meninggalkan halaman. Setelah dibuat, pemanggil
 * memuat ulang referensi dan memilih entri baru secara otomatis.
 */
export default function OrgQuickAdd({ kind, departmentId, disabled, onCreated }: Props) {
  const isDept = kind === 'department';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const blocked = !!disabled || (!isDept && !departmentId);
  const label = isDept ? 'Tambah departemen baru' : 'Tambah posisi baru';
  const placeholder = isDept ? 'mis. Marketing & Penjualan' : 'mis. Staf Akuntansi';
  const extraPlaceholder = isDept ? 'Divisi (opsional), mis. Commercial' : 'Grade (opsional), mis. 3';

  async function submit(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Guard required fields (no native form validation since we are not a <form>).
    if (name.trim().length < 2) { setErr(isDept ? 'Nama departemen minimal 2 karakter.' : 'Nama posisi minimal 2 karakter.'); return; }
    setBusy(true); setErr(null);
    const url = isDept ? '/api/v1/recruitment/departments' : '/api/v1/recruitment/positions';
    const payload = isDept
      ? { departmentName: name.trim(), divisionName: extra.trim() || null }
      : { departmentId, positionTitle: name.trim(), jobGrade: extra.trim() || null };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j?.detail || j?.message || 'Gagal menyimpan.'); return; }
      await onCreated({ id: j.data.id, name: name.trim() });
      setOpen(false); setName(''); setExtra(''); setErr(null);
    } catch {
      setErr('Gagal menyimpan. Periksa koneksi.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={blocked}
        title={!isDept && !departmentId ? 'Pilih departemen terlebih dahulu' : label}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#007a5a] hover:underline disabled:opacity-40 disabled:no-underline"
      >
        <Plus className="h-3 w-3" /> {label}
      </button>
    );
  }

  return (
    <div
      className="mt-1.5 space-y-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(e); }}
        placeholder={placeholder}
        minLength={2}
        className="w-full rounded-md border border-[#e2e8f0] px-2 py-1.5 text-xs"
      />
      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(e); }}
        placeholder={extraPlaceholder}
        className="w-full rounded-md border border-[#e2e8f0] px-2 py-1.5 text-xs"
      />
      {err && <p className="text-[10px] font-semibold text-rose-600">{err}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="rounded-md px-2 py-1 text-[10px] text-[#64748b] hover:bg-[#f1f5f9]">
          Batal
        </button>
        <button type="button" onClick={submit} disabled={busy} className="rounded-md bg-[#007a5a] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#006347] disabled:opacity-50">
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
