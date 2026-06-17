import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { getNda, deleteNda } from "@/lib/ndaStore";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const nda = await getNda(email, id);
  if (!nda) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(nda);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteNda(email, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
