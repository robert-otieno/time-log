import 'server-only';
import { NextResponse } from 'next/server';
import { toggleHabitCompletion } from '@/app/actions/goals';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const result = await toggleHabitCompletion(params.id, body.date, body.value);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}