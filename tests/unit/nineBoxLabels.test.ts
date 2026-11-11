import { describe, it, expect } from 'vitest';
import { NINE_BOX_COPY, nineBoxCopy, nineBoxLabel, potentialLabel } from '@/lib/employee/nineBoxLabels';

describe('nineBoxLabels', () => {
  it('setiap kode 9-box punya nama Indonesia, bukan istilah Inggris lama', () => {
    const banned = [
      'Enigma',
      'Growth Star',
      'Future Leader',
      'High Impact',
      'Core Player',
      'Dilemma',
      'Trusted Pro',
      'Effective Pro',
      'Underperformer',
    ];
    for (const copy of Object.values(NINE_BOX_COPY)) {
      for (const b of banned) expect(copy.name).not.toContain(b);
    }
  });

  it('ENIGMA memakai nama posisional, bukan nama puitis', () => {
    // Nama posisional dengan istilah sehari-hari: kemampuan vs hasil kerja.
    expect(nineBoxLabel('ENIGMA')).toBe('Siap Naik Level, Hasil Kerja Rendah');
    expect(NINE_BOX_COPY.ENIGMA.position).toBe('siap naik level · hasil kerja rendah');
  });

  it('kode tak dikenal dikembalikan sebagai kotak tidak dikenali, bukan crash', () => {
    const copy = nineBoxCopy('SOMETHING_ELSE');
    expect(copy.name).toBe('Kotak tidak dikenali');
    expect(copy.short.length).toBeGreaterThan(0);
  });

  it('label potensi mengikuti ambang engine (3.0 dan 4.0)', () => {
    expect(potentialLabel(2.9)).toBe('Potensi rendah');
    expect(potentialLabel(3.0)).toBe('Potensi sedang');
    expect(potentialLabel(3.9)).toBe('Potensi sedang');
    expect(potentialLabel(4.0)).toBe('Potensi tinggi');
    expect(potentialLabel(5.0)).toBe('Potensi tinggi');
  });
});
