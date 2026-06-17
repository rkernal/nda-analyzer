import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { listAnalyses } from "@/lib/analysisStore";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listAnalyses(email));
}
