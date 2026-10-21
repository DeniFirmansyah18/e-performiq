'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface Card {
  bpjsTkNumber: string | null;
  bpjsKesNumber: string | null;
  bpjsKesClass: string | null;
  bpjsTkStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  bpjsKesStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  registeredAt: string | null;
}

const STATUS_LABEL: Record<Card['bpjsTkStatus'], string> = {
  ACTIVE: 'Aktif', INACTIVE: 'Tidak aktif', PENDING: 'Menunggu aktivasi',
};

export default function SocialSecurityCard() {
  const [card, setCard] = useState<Card | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/social-security')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setCard(j?.data ?? null); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, []);

  const reveal = async () => {
    const reason = window.prompt('Alasan membuka nomor lengkap (tercatat di audit log):') ?? '';
    if (reason.trim().length < 5) { setMessage('Alasan minimal 5 karakter.'); return; }
    const res = await fetch('/api/v1/me/social-security/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal membuka nomor.'); return; }
    setCard((c) => (c ? { ...c, ...json.data } : c));
    setMessage('Nomor ditampilkan. Akses tercatat pada audit log.');
  };

  if (!card) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-xs text-[#64748b]">
        Data BPJS belum terdaftar atau belum dapat dimuat.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#007a5a]" aria-hidden="true" />
        <h2 className="text-sm font-extrabold text-[#0f172a]">BPJS Ketenagakerjaan & Kesehatan</h2>
      </div>

      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="text-[#64748b]">BPJS Ketenagakerjaan</dt>
          <dd className="font-semibold text-[#0f172a]">{card.bpjsTkNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[#64748b]">BPJS Kesehatan</dt>
          <dd className="font-semibold text-[#0f172a]">
            {card.bpjsKesNumber ?? '—'} {card.bpjsKesClass ? `· ${card.bpjsKesClass}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748b]">Status</dt>
          <dd className="font-semibold text-[#0f172a]">{STATUS_LABEL[card.bpjsTkStatus]}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={reveal}
        className="mt-3 rounded-lg border border-[#007a5a] px-3 py-1.5 text-xs font-semibold text-[#007a5a] hover:bg-[#e6f4ea] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
      >
        Tampilkan nomor lengkap
      </button>

      {message && <p className="mt-2 text-[11px] text-[#475569]">{message}</p>}
    </section>
  );
}
