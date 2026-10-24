import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getActionRecommendations } from '@/lib/services/hrActionRecommendationService';

export async function GET() {
  try {
    const data = await getActionRecommendations(db);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
