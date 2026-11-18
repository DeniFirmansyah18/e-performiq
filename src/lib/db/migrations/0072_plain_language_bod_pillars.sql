-- Replace only the two standard BOD pillar labels; preserve custom pillars and all related data.
UPDATE strategic_pillars
SET pillar_name = 'Pelayanan yang Memuaskan.'
WHERE perspective = 'CUSTOMER'
  AND pillar_name = 'Kepuasan Stakeholder & Keunggulan Layanan Ekosistem';

UPDATE strategic_pillars
SET pillar_name = 'Proses Kerja Tertib dan Andal.'
WHERE perspective = 'INTERNAL_PROCESS'
  AND pillar_name = 'Keunggulan Operasional & Zero Fatal SOP Compliance';
