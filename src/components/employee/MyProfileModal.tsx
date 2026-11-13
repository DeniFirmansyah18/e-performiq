'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera } from 'lucide-react';
import { useAuth, useOptionalAuth } from '@/lib/context/AuthContext';
import SocialSecurityCard from '@/components/employee/SocialSecurityCard';
import BerkasKepegawaianPanel from '@/components/employee/BerkasKepegawaianPanel';

interface Profile {
  employeeCode: string; fullName: string; email: string; status: string;
  phoneNumber?: string; address?: string; dateOfBirth?: string;
  emergencyContactName?: string; emergencyContactPhone?: string; photoUrl?: string; bio?: string;
  gender?: string; nik?: string;
  // Konteks kepegawaian (dari JOIN di getMyProfile).
  positionTitle?: string | null; departmentName?: string | null;
  managerName?: string | null; managerCode?: string | null;
  directReportCount?: number; joinDate?: string | null;
}

/** Masa kerja dalam "X tahun Y bulan". Nilai kosong/tidak valid -> "-". */
function hitungMasaKerja(joinDate?: string | null): string {
  if (!joinDate) return '-';
  const mulai = new Date(joinDate);
  if (Number.isNaN(mulai.getTime())) return '-';

  const kini = new Date();
  let bulan = (kini.getFullYear() - mulai.getFullYear()) * 12 + (kini.getMonth() - mulai.getMonth());
  if (kini.getDate() < mulai.getDate()) bulan -= 1;
  if (bulan < 0) return '-';
  if (bulan === 0) return '< 1 bulan';

  const tahun = Math.floor(bulan / 12);
  const sisaBulan = bulan % 12;
  if (tahun === 0) return `${sisaBulan} bulan`;
  return sisaBulan === 0 ? `${tahun} tahun` : `${tahun} tahun ${sisaBulan} bulan`;
}

const GENDER_LABEL: Record<string, string> = { LAKI_LAKI: 'Laki-laki', PEREMPUAN: 'Perempuan' };

/** Kecilkan foto profil ke data URL agar aman disimpan di kolom teks (serverless). */
async function shrinkToDataUrl(file: File, maxDim = 320): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Gagal membaca berkas'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Gambar tidak valid'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.7);
}

const EDITABLE = ['phone_number', 'address', 'date_of_birth', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url', 'bio'] as const;
type EditableField = (typeof EDITABLE)[number];

/** Menu "Profil Saya": ubah field terbatas + tampilan read-only field sensitif. */
export default function MyProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { refreshUser } = useAuth();
  // Peran menentukan blok kepegawaian yang ditampilkan; aman bila tanpa provider.
  const role = useOptionalAuth()?.currentUser?.role;

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
      if (res.ok) {
        setMsg('Profil berhasil diperbarui.');
        await refreshUser();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.detail || 'Gagal memperbarui profil.');
      }
    } finally { setSaving(false); }
  };

  const onPickPhoto = async (file?: File | null) => {
    if (!file) return;
    try {
      const url = await shrinkToDataUrl(file);
      setForm((f) => ({ ...f, photo_url: url }));
    } catch {
      setMsg('Foto tidak dapat diproses.');
    }
  };

  if (!isOpen) return null;

  const editable = (key: EditableField, label: string, type = 'text') => (
    <label className="block text-xs">
      <span className="font-semibold text-[#334155]">{label}</span>
      <input type={type} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between p-4 sticky top-0 bg-gradient-to-r from-[#0f172a] to-[#134e4a] text-white">
          <h3 className="text-sm font-extrabold text-white">Profil Saya</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Read-only sensitive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="text-xs"><span className="text-[#64748b]">NIP</span><p className="font-bold text-[#0f172a]">{profile?.employeeCode}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Nama</span><p className="font-bold text-[#0f172a]">{profile?.fullName}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Email</span><p className="font-bold text-[#0f172a]">{profile?.email}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Status</span><p className="font-bold text-[#0f172a]">{profile?.status}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">NIK</span><p className="font-bold text-[#0f172a]">{profile?.nik || '-'}</p></div>
            <div className="text-xs"><span className="text-[#64748b]">Jenis Kelamin</span><p className="font-bold text-[#0f172a]">{profile?.gender ? (GENDER_LABEL[profile.gender] ?? profile.gender) : '-'}</p></div>
            <p className="text-[10px] text-[#64748b] sm:col-span-2">Field bertanda di atas bersifat read-only (dikelola HR).</p>
          </div>

          {/* Kepegawaian — konteks peran; BOD tidak menampilkan "Dinilai oleh". */}
          <div className="p-3 rounded-xl bg-white border border-[#e2e8f0] space-y-2">
            <p className="text-xs font-bold text-[#0f172a]">Kepegawaian</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="text-xs">
                <span className="text-[#64748b]">Jabatan</span>
                <p className="font-bold text-[#0f172a]">{profile?.positionTitle ?? '-'}</p>
              </div>
              <div className="text-xs">
                <span className="text-[#64748b]">Departemen</span>
                <p className="font-bold text-[#0f172a]">{profile?.departmentName ?? '-'}</p>
              </div>
              <div className="text-xs">
                <span className="text-[#64748b]">Tanggal Masuk</span>
                <p className="font-bold text-[#0f172a]">
                  {profile?.joinDate ? String(profile.joinDate).slice(0, 10) : '-'}
                </p>
              </div>
              <div className="text-xs">
                <span className="text-[#64748b]">Masa Kerja</span>
                <p className="font-bold text-[#0f172a]">{hitungMasaKerja(profile?.joinDate)}</p>
              </div>
              {role !== 'BOD' && profile?.managerName && (
                <div className="text-xs sm:col-span-2">
                  <span className="text-[#64748b]">Dinilai oleh</span>
                  <p className="font-bold text-[#0f172a]">
                    {profile.managerName}
                    {profile.managerCode ? ` (${profile.managerCode})` : ''}
                  </p>
                </div>
              )}
              {role !== 'EMPLOYEE' && (profile?.directReportCount ?? 0) > 0 && (
                <div className="text-xs sm:col-span-2">
                  <span className="text-[#64748b]">Bawahan Langsung</span>
                  <p className="font-bold text-[#0f172a]">{profile?.directReportCount} bawahan langsung</p>
                </div>
              )}
            </div>
          </div>

          {/* Editable */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#e2e8f0]">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-[#f1f5f9] flex items-center justify-center ring-1 ring-[#e2e8f0] shrink-0">
              {form.photo_url
                ? <img src={form.photo_url} alt="Foto profil" className="h-full w-full object-cover" />
                : <Camera className="h-6 w-6 text-[#94a3b8]" />}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#334155]">Foto Profil</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => { await onPickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-[11px] font-bold hover:bg-[#006347]">
                  <Camera className="h-3 w-3" /> Unggah Foto
                </button>
                {form.photo_url && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}
                    className="text-[11px] font-semibold text-rose-600 hover:underline">Hapus</button>
                )}
              </div>
              <p className="text-[10px] text-[#64748b]">JPG/PNG, otomatis diperkecil. Tersimpan saat klik Simpan.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {editable('phone_number', 'Telepon')}
            {editable('date_of_birth', 'Tanggal Lahir', 'date')}
            {editable('emergency_contact_name', 'Kontak Darurat (Nama)')}
            {editable('emergency_contact_phone', 'Kontak Darurat (Telepon)')}
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

        {/* Data kepegawaian: BPJS, berkas, kelengkapan & kedaluwarsa dokumen
            digabung di sini agar pegawai menemukan seluruh data pribadinya
            dalam satu tempat. Panel berkas dipakai bersama dengan direktori HR
            sehingga PEOPLE MANAGER, BOD, dan HR melihat data yang sama. */}
        <div className="p-5 space-y-3 border-t border-[#e2e8f0] bg-[#fafcfb]">
          <p className="text-xs font-extrabold text-[#0f172a]">Data Kepegawaian</p>
          <SocialSecurityCard />
          <BerkasKepegawaianPanel bolehUnggah />
        </div>
      </div>
    </div>,
    document.body
  );
}
