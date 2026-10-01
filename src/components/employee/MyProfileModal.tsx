'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Profile {
  employeeCode: string; fullName: string; email: string; status: string;
  phoneNumber?: string; address?: string; dateOfBirth?: string;
  emergencyContactName?: string; emergencyContactPhone?: string; photoUrl?: string; bio?: string;
}

const EDITABLE = ['phone_number', 'address', 'date_of_birth', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url', 'bio'] as const;
type EditableField = (typeof EDITABLE)[number];

/** Menu "Profil Saya": ubah field terbatas + tampilan read-only field sensitif. */
export default function MyProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/v1/profile/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        setProfile(j.data);
        setForm({
          phone_number: j.data.phoneNumber ?? '', address: j.data.address ?? '',
          date_of_birth: (j.data.dateOfBirth ?? '').slice(0, 10),
          emergency_contact_name: j.data.emergencyContactName ?? '',
          emergency_contact_phone: j.data.emergencyContactPhone ?? '',
          photo_url: j.data.photoUrl ?? '', bio: j.data.bio ?? '',
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/profile/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setMsg(res.ok ? 'Profil berhasil diperbarui.' : 'Gagal memperbarui profil.');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  const editable = (key: EditableField, label: string, type = 'text') => (
    <label className="block text-xs">
      <span className="font-semibold text-[#334155]">{label}</span>
      <input type={type} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4 sticky top-0 bg-white">
          <h3 className="text-sm font-extrabold text-[#0f172a]">Profil Saya</h3>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Read-only sensitive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="text-xs"><span className="text-[#64748b]">NIP</span><p className="font-bold text-[#0f172a]">{profile?.employeeCode}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Nama</span><p className="font-bold text-[#0f172a]">{profile?.fullName}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Email</span><p className="font-bold text-[#0f172a]">{profile?.email}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Status</span><p className="font-bold text-[#0f172a]">{profile?.status}</p></div>
            <p className="text-[10px] text-[#64748b] sm:col-span-2">Field bertanda di atas bersifat read-only (dikelola HR).</p>
          </div>

          {/* Editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {editable('phone_number', 'Telepon')}
            {editable('date_of_birth', 'Tanggal Lahir', 'date')}
            {editable('emergency_contact_name', 'Kontak Darurat (Nama)')}
            {editable('emergency_contact_phone', 'Kontak Darurat (Telepon)')}
            {editable('photo_url', 'URL Foto')}
          </div>
          {editable('address', 'Alamat')}
          <label className="block text-xs">
            <span className="font-semibold text-[#334155]">Bio Singkat</span>
            <textarea value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs h-20" />
          </label>

          {msg && <p className="text-[11px] font-semibold text-[#137333]">{msg}</p>}
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-60">
            {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
