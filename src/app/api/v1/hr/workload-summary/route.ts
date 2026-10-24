import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { calculateWorkloadSummary } from '@/lib/services/workloadService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const data = await calculateWorkloadSummary(db, { departmentId, fromDate, toDate });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
