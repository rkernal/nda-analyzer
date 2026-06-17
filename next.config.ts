import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy node-only libs used for local file parsing — keep them external so
  // they aren't bundled into the serverless functions (mammoth reads fs at
  // runtime; unpdf pulls in pdfjs). See PORTING-SPEC §3.
  serverExternalPackages: ["mammoth", "unpdf"],
  // Uploads (PDF/DOCX) may flow through Server Actions, whose default body
  // limit is 1 MB — far too small for documents. Raise it.
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
