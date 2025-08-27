import 'server-only';
import { NextResponse } from 'next/server';
import { addHabit } from '@/app/actions/goals';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const habit = await addHabit(body);
    return NextResponse.json(habit);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}