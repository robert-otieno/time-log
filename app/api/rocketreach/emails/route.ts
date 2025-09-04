import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://api.rocketreach.co/api/v2';

// If your account uses a different header, switch to:
//   const headers = { 'X-Api-Key': process.env.ROCKETREACH_API_KEY! };
const headers: Record<string, string> = {
  Authorization: `Bearer ${process.env.ROCKETREACH_API_KEY!}`,
};

async function rrGet(path: string, params: Record<string, any>) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers, cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RocketReach ${res.status}: ${body}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company');
    if (!company) {
      return NextResponse.json({ error: 'Missing ?company=' }, { status: 400 });
    }

    // Options
    const limit = Number(searchParams.get('limit') || 500);    // max emails to return
    const perPage = Number(searchParams.get('perPage') || 100); // RR page size

    // Collect ALL emails (no work/personal filtering)
    const emails = new Set<string>();
    let page = 1;

    while (emails.size < limit) {
      // Adjust param names if your account differs (e.g., employer vs current_employer)
      const data = await rrGet('/search/people', {
        current_employer: company,
        page,
        page_size: perPage,
      });

      const results: any[] = data?.results || data?.people || [];
      if (!results.length) break;

      for (const p of results) {
        const arr = Array.isArray(p.emails) ? p.emails : [];
        for (const e of arr) {
          const addr = String(e.email || e.address || '').toLowerCase().trim();
          if (!addr || !addr.includes('@')) continue; // light validation
          emails.add(addr);
          if (emails.size >= limit) break;
        }
        if (emails.size >= limit) break;
      }

      page += 1;
      // Gentle pacing to avoid rate limits
      await new Promise((r) => setTimeout(r, 250));
    }

    const data = JSON.stringify(Array.from(emails), null, 2);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${company.replace(/\s+/g, '_')}_emails.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('emails route error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
