import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NINE_BOX_COPY, NINE_BOX_BOX_NUMBER } from '@/lib/employee/nineBoxLabels';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('regresi kualitas teks 9-Box', () => {
  it('tidak ada karakter rusak (mojibake / U+FFFD) di berkas yang dilihat pengguna', () => {
    const files = [
      'src/app/dashboard/ninebox-matrix/page.tsx',
      'src/app/dashboard/manager-cockpit/page.tsx',
      'src/components/charts/NineBoxGrid.tsx',
      'src/components/guide/faqData.ts',
      'src/lib/employee/nineBoxLabels.ts',
      'src/components/governance/HrOverviewAnalyticsPanel.tsx',
    ];
    for (const f of files) {
      const t = read(f);
      expect(t, `${f} mengandung U+FFFD`).not.toContain('\uFFFD');
      expect(t, `${f} mengandung mojibake`).not.toMatch(/â€|Â·|Ã¢/);
      expect(t, `${f} diawali BOM`).not.toMatch(/^\uFEFF/);
    }
  });

  it('tidak ada lagi angka demo 1240/42/180/12 sebagai fallback', () => {
    const t = read('src/app/dashboard/ninebox-matrix/page.tsx');
    expect(t).not.toMatch(/\?\?\s*(1240|42|180|12)\b/);
  });

  it('nomor kotak konsisten: FUTURE_LEADER = 9, UNDERPERFORMER = 1', () => {
    expect(NINE_BOX_BOX_NUMBER.FUTURE_LEADER).toBe(9);
    expect(NINE_BOX_BOX_NUMBER.UNDERPERFORMER).toBe(1);
    expect(new Set(Object.values(NINE_BOX_BOX_NUMBER)).size).toBe(9);
  });

  it('teks panduan tidak menyatakan sebab sebagai fakta', () => {
    const terlarang = ['bukan kurang mampu', 'biasanya karena pengalaman', 'tidak mengejar peran memimpin'];
    for (const copy of Object.values(NINE_BOX_COPY)) {
      for (const frasa of terlarang) {
        expect(copy.happening).not.toContain(frasa);
      }
    }
  });
});
