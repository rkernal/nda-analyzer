import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/session";
import { extractText } from "@/lib/extractText";

// Local file-parse route (cost opt #1). Accepts a PDF or DOCX upload and parses
// it locally (unpdf / mammoth); Claude is only used as a scanned-PDF fallback.
export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, usedClaudeFallback } = await extractText(buffer, { mime: file.type, filename: file.name });
    if (!text) {
      return NextResponse.json({ error: "No text could be extracted from this file." }, { status: 422 });
    }
    return NextResponse.json({ text, usedClaudeFallback });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to extract text from file." },
      { status: 500 },
    );
  }
}
