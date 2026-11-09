import { describe, it, expect } from 'vitest';
import { FAQ_DATA } from '@/components/guide/faqData';
import { NINE_BOX_COPY } from '@/lib/employee/nineBoxLabels';

describe('FAQ 9-Box', () => {
  it('tidak memakai nama kotak yang berbeda dari grid', () => {
    const teks = JSON.stringify(FAQ_DATA);
    for (const lama of ['Growth Leader', 'Core Backbone', 'Future Leader', 'Trusted Pro', 'Effective Pro']) {
      expect(teks).not.toContain(lama);
    }
  });

  it('memuat kesembilan nama kotak dari modul bersama', () => {
    const teks = JSON.stringify(FAQ_DATA);
    for (const copy of Object.values(NINE_BOX_COPY)) {
      if (copy.name === 'Kotak tidak dikenali') continue;
      expect(teks).toContain(copy.name);
    }
  });
});
