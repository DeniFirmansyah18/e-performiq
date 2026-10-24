import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { getContractsSummary } from '@/lib/services/contractService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const refDate = searchParams.get('refDate') || undefined;

    const data = await getContractsSummary(db, refDate);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
