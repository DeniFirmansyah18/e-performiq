import { describe, it, expect } from 'vitest';
import { calculateFlightRisk } from '@/lib/services/coreHrService';

describe('Kotak 4: Core HR & Flight Risk Engine', () => {
it('mendeteksi HIGH Flight Risk jika absensi terganggu, peer review turun, dan jam kerja berlebih', () => {
const risk = calculateFlightRisk({
employeeId: 'budi',
bradfordFactor: 65, // di atas batas normal 45
peerReviewAvg: 2.8, // nilai rendah
overtimeHoursWeekly: 14, // beban lembur tinggi
contractDaysRemaining: 40,
});
expect(risk.level).toBe('HIGH');
expect(risk.warnings).toContain('Indeks Bradford absensi mengindikasikan ketidakhadiran berulang');
});

it('mendeteksi LOW Flight Risk pada karyawan dengan rekam jejak stabil', () => {
const risk = calculateFlightRisk({
employeeId: 'siti',
bradfordFactor: 5,
peerReviewAvg: 4.5,
overtimeHoursWeekly: 2,
contractDaysRemaining: 300,
});
expect(risk.level).toBe('LOW');
});
});
