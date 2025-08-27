import 'server-only';
import { NextResponse } from 'next/server';
import { deleteHabit } from '@/app/actions/goals';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await deleteHabit(params.id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}