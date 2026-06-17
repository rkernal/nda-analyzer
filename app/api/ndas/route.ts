import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { listNdas, createNda } from "@/lib/ndaStore";
import type { NDAStatus } from "@/types";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listNdas(email));
}

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { name, status, rawText, originalRawText, clauses, originalClauses } = body;
  if (!name || !status || !rawText) {
    return NextResponse.json({ error: "Name, status, and text are required" }, { status: 400 });
  }

  const nda = await createNda(email, {
    name,
    status: status as NDAStatus,
    rawText,
    originalRawText: originalRawText || null,
    clauses: clauses || [],
    originalClauses: originalClauses || null,
  });
  return NextResponse.json(nda, { status: 201 });
}
