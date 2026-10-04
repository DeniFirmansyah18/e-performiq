'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface AddressValue {
  /** Alamat jalan lengkap (teks bebas). */
  address: string;
  province: string;
  city: string;
  district: string;
  village: string;
  postalCode: string;
}

interface Props {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
}

interface Item { kode: string; nama: string }

const emptyAddr = (): AddressValue => ({ address: '', province: '', city: '', district: '', village: '', postalCode: '' });

async function fetchItems(level: string, parent = ''): Promise<Item[]> {
  try {
    const url = `/api/v1/reference/wilayah?level=${level}${parent ? `&parent=${encodeURIComponent(parent)}` : ''}`;
    const res = await fetch(url);
    const j = await res.json().catch(() => ({}));
    return j?.data?.items ?? [];
  } catch { return []; }
}

/**
 * Pemilih alamat bertingkat (Provinsi → Kab/Kota → Kecamatan → Desa/Kelurahan)
 * + kode pos. Selalu punya data lokal (provinsi/kabupaten/kecamatan); desa &
 * kode pos diperkaya dari Wilayah Alamat API bila tersedia.
 */
export default function AddressSelect({ value, onChange }: Props) {
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [kabupaten, setKabupaten] = useState<Item[]>([]);
  const [kecamatan, setKecamatan] = useState<Item[]>([]);
  const [desa, setDesa] = useState<Item[]>([]);
  const [kodepos, setKodepos] = useState('');
  const [kpResults, setKpResults] = useState<Item[]>([]);
  const [apiConfigured, setApiConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const kpTimer = useRef<any>(null);

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/v1/reference/wilayah?level=provinsi').catch(() => null);
      const j = await res?.json().catch(() => ({}));
      setProvinces(j?.data?.items ?? []);
      setApiConfigured(j?.data?.apiConfigured ?? j?.data?.configured ?? true);
    })();
  }, []);

  const onProvince = async (nama: string) => {
    set({ province: nama, city: '', district: '', village: '' });
    setKabupaten([]); setKecamatan([]); setDesa([]);
    const prov = provinces.find((p) => p.nama === nama);
    if (prov) { setLoading(true); setKabupaten(await fetchItems('kabupaten', prov.kode)); setLoading(false); }
  };
  const onKabupaten = async (nama: string) => {
    set({ city: nama, district: '', village: '' });
    setKecamatan([]); setDesa([]);
    const kab = kabupaten.find((k) => k.nama === nama);
    if (kab) { setLoading(true); setKecamatan(await fetchItems('kecamatan', kab.kode)); setLoading(false); }
  };
  const onKecamatan = async (nama: string) => {
    set({ district: nama, village: '' });
    setDesa([]);
    const kec = kecamatan.find((k) => k.nama === nama);
    if (kec) { setLoading(true); setDesa(await fetchItems('desa', kec.kode)); setLoading(false); }
  };
  const onDesa = (nama: string) => {
    set({ village: nama });
  };

  // Kode pos → cari desa & auto-isi hierarki (butuh API).
  const onKodepos = (kp: string) => {
    setKodepos(kp);
    set({ postalCode: kp });
    if (kpTimer.current) clearTimeout(kpTimer.current);
    if (kp.replace(/\D/g, '').length < 4) { setKpResults([]); return; }
    kpTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/reference/kodepos/${encodeURIComponent(kp)}`);
        const j = await res.json().catch(() => ({}));
        setKpResults(j?.data?.items ?? []);
      } catch { setKpResults([]); }
    }, 350);
  };

  const applyKodeposResult = (item: Item & { alamat_lengkap?: string | null; kodepos?: string | null }) => {
    const parts = String(item.alamat_lengkap ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const village = parts[0]?.replace(/^(Desa|Kelurahan)\s+/i, '') ?? '';
    const district = parts[1]?.replace(/^Kecamatan\s+/i, '') ?? '';
    const city = parts[2]?.replace(/^(Kabupaten|Kota)\s+/i, '') ?? '';
    const province = parts[3] ?? '';
    set({
      village: village || value.village, district: district || value.district,
      city: city || value.city, province: province || value.province,
      postalCode: item.kodepos ?? value.postalCode,
    });
    setKpResults([]);
    (async () => {
      const prov = provinces.find((p) => p.nama === province);
      if (prov) {
        const kab = await fetchItems('kabupaten', prov.kode); setKabupaten(kab);
        const kk = kab.find((k) => k.nama === city || k.nama === `Kota ${city}` || k.nama === `Kabupaten ${city}`);
        if (kk) {
          const kec = await fetchItems('kecamatan', kk.kode); setKecamatan(kec);
          const cc = kec.find((k) => k.nama === district);
          if (cc) setDesa(await fetchItems('desa', cc.kode));
        }
      }
    })();
  };

  const summary = useMemo(() => {
    const parts = [value.village, value.district, value.city, value.province].filter(Boolean);
    return parts.join(', ') + (value.postalCode ? ` ${value.postalCode}` : '');
  }, [value]);

  const sel = 'mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs';

  return (
    <div className="p-3 rounded-xl border border-[#e2e8f0] space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#0f172a]">Alamat</p>
        <button type="button" onClick={() => setShowManual((s) => !s)} className="text-[10px] font-semibold text-[#007a5a]">
          {showManual ? 'Gunakan pilih wilayah' : 'Ketik manual'}
        </button>
      </div>

      <label className="block text-[11px] text-[#334155]">
        <span className="font-semibold">Alamat jalan / detail</span>
        <input value={value.address} onChange={(e) => set({ address: e.target.value })}
          placeholder="Jl. Merdeka No. 10, RT/RW 01/02"
          className={sel} />
      </label>

      {!showManual && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Provinsi</span>
              <select value={value.province} onChange={(e) => onProvince(e.target.value)} className={sel}>
                <option value="">— Pilih —</option>
                {provinces.map((p) => <option key={p.kode} value={p.nama}>{p.nama}</option>)}
                {value.province && !provinces.some((p) => p.nama === value.province) && <option value={value.province}>{value.province}</option>}
              </select></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Kabupaten / Kota</span>
              <select value={value.city} onChange={(e) => onKabupaten(e.target.value)} className={sel} disabled={kabupaten.length === 0}>
                <option value="">— Pilih —</option>
                {kabupaten.map((p) => <option key={p.kode} value={p.nama}>{p.nama}</option>)}
                {value.city && !kabupaten.some((k) => k.nama === value.city) && <option value={value.city}>{value.city}</option>}
              </select></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Kecamatan</span>
              <select value={value.district} onChange={(e) => onKecamatan(e.target.value)} className={sel} disabled={kecamatan.length === 0}>
                <option value="">— Pilih —</option>
                {kecamatan.map((p) => <option key={p.kode} value={p.nama}>{p.nama}</option>)}
                {value.district && !kecamatan.some((k) => k.nama === value.district) && <option value={value.district}>{value.district}</option>}
              </select></label>
            <label className="text-[11px] text-[#334155]"><span className="font-semibold">Desa / Kelurahan</span>
              {desa.length > 0 ? (
                <select value={value.village} onChange={(e) => onDesa(e.target.value)} className={sel}>
                  <option value="">— Pilih —</option>
                  {desa.map((p) => <option key={p.kode} value={p.nama}>{p.nama}</option>)}
                  {value.village && !desa.some((k) => k.nama === value.village) && <option value={value.village}>{value.village}</option>}
                </select>
              ) : (
                <input value={value.village} onChange={(e) => set({ village: e.target.value })}
                  placeholder="Ketik nama desa/kelurahan" className={sel} />
              )}
            </label>
          </div>

          <label className="block text-[11px] text-[#334155]">
            <span className="font-semibold">Kode Pos</span>
            <input value={kodepos} onChange={(e) => onKodepos(e.target.value)} inputMode="numeric" maxLength={5}
              placeholder="mis. 65161" className={sel} />
          </label>

          {kpResults.length > 0 && (
            <div className="rounded-lg border border-[#e2e8f0] bg-white max-h-40 overflow-y-auto">
              {kpResults.map((r: any) => (
                <button key={r.kode} type="button" onClick={() => applyKodeposResult(r)}
                  className="block w-full text-left px-3 py-2 hover:bg-[#f1f5f9] border-b border-[#f8fafc] last:border-0">
                  <span className="text-[11px] font-semibold text-[#0f172a]">{r.nama}</span>
                  <span className="block text-[10px] text-[#64748b]">{r.alamat_lengkap}</span>
                </button>
              ))}
            </div>
          )}

          {loading && <p className="text-[10px] text-[#64748b]">Memuat wilayah…</p>}
          {!apiConfigured && (
            <p className="text-[10px] text-[#64748b]">
              Data wilayah dasar tersedia offline. Untuk pencarian desa &amp; kode pos lengkap,
              aktifkan layanan wilayah (set <code>WILAYAH_API_URL</code>).
            </p>
          )}
        </>
      )}

      {summary && (
        <p className="text-[10px] text-[#475569] rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5">
          <b>Alamat lengkap:</b> {[value.address, summary].filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  );
}

export { emptyAddr };
