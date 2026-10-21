'use client';

import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';

interface Doc {
  id: string;
  documentType: string;
  fileUrl: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  expiryDate: string | null;
}

const STATUS_LABEL: Record<Doc['verificationStatus'], string> = {
  PENDING: 'Menunggu verifikasi',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
};

/**
 * Ruling R2: PRD §5.6 meminta unggah berkas, tetapi rencana Fase 2 hanya
 * membangun API-nya. Kartu ini membuat endpoint itu terjangkau dari portal.
 */
export default function DocumentsCard() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/documents')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setDocs(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-[#007a5a]" aria-hidden="true" />
        <h2 className="text-sm font-extrabold text-[#0f172a]">Berkas Kepegawaian</h2>
      </div>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Unggah PDF/JPG/PNG maksimal 5 MB. HRD memverifikasi setiap berkas.
      </p>

      <ul className="mt-3 divide-y divide-[#e2e8f0]">
        {docs.map((d) => (
          <li key={d.id} className="py-2 text-xs">
            <p className="font-semibold text-[#0f172a]">{d.documentType}</p>
            <p className="text-[#64748b]">
              {STATUS_LABEL[d.verificationStatus]}
              {d.expiryDate ? ` · berlaku s.d. ${String(d.expiryDate).slice(0, 10)}` : ''}
            </p>
          </li>
        ))}
        {loaded && docs.length === 0 && (
          <li className="py-2 text-xs text-[#64748b]">Belum ada berkas terunggah.</li>
        )}
        {!loaded && <li className="py-2 text-xs text-[#64748b]">Memuat berkas…</li>}
      </ul>
    </section>
  );
}
