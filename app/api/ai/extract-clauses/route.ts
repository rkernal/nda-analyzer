import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { extractClauses } from "@/lib/extractClauses";

// Used by the library "add" flow to pre-extract clauses (final + original).
// Runs on MODEL_FAST via lib/extractClauses (forced tool use + chunking).
export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  try {
    const clauses = await extractClauses(text);
    return NextResponse.json({ clauses });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to extract clauses: ${e instanceof Error ? e.message : "Unknown error"}` },
      { status: 500 },
    );
  }
}
