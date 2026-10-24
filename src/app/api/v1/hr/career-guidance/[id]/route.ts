import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getCareerGuidanceForEmployee } from '@/lib/services/hrActionRecommendationService';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await getCareerGuidanceForEmployee(db, params.id);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    const status = error.message === 'Karyawan tidak ditemukan.' ? 404 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
