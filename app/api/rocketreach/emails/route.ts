// app/api/rocketreach/emails/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.ROCKETREACH_API_BASE ?? "https://api.rocketreach.co/api/v2/";
// Many accounts use 'X-Api-Key'. If yours uses Bearer, swap the header below.
const headers: Record<string, string> = {
  "X-Api-Key": process.env.ROCKETREACH_API_KEY!,
  Accept: "application/json",
};

function buildUrl(path: string, params: Record<string, any>) {
  const clean = path.replace(/^\//, ""); // <— important: no leading slash
  const url = new URL(clean, API_BASE); // results in .../api/v2/search/people
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function rrGet(path: string, params: Record<string, any>) {
  const url = buildUrl(path, params);
  const res = await fetch(url, { headers, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RocketReach ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from API: ${text.slice(0, 200)}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    if (!company) return NextResponse.json({ error: "Missing ?company=" }, { status: 400 });

    const limit = Number(searchParams.get("limit") || 2000);
    const perPage = Number(searchParams.get("perPage") || 100);

    const emails = new Set<string>();
    let page = 1;

    while (emails.size < limit) {
      // Some accounts use 'employer' instead of 'current_employer' — we can set both.
      const data = await rrGet("search/people", {
        current_employer: company,
        employer: company,
        page,
        page_size: perPage,
      });

      const results: any[] = data?.results || data?.people || [];
      if (!results.length) break;

      for (const p of results) {
        const arr = Array.isArray(p.emails) ? p.emails : [];
        for (const e of arr) {
          const addr = String(e.email || e.address || "")
            .toLowerCase()
            .trim();
          if (addr.includes("@")) {
            emails.add(addr);
            if (emails.size >= limit) break;
          }
        }
        if (emails.size >= limit) break;
      }

      page += 1;
      await new Promise((r) => setTimeout(r, 250)); // gentle pacing
    }

    const dataOut = JSON.stringify([...emails], null, 2);
    return new NextResponse(dataOut, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${company.replace(/\s+/g, "_")}_emails.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
