# NDA Analyzer — context for Claude

Internal Cornerstone tool, part of **The Sandbox** prototype suite. It is a
**fresh, Sandbox-native rebuild** of an existing standalone app ("Signalign")
that currently lives at `..\NDAnalyzer\nda-analyzer` and is deployed on a
separate Vercel project that Ryan is decommissioning. We are NOT upgrading that
app in place — we stand up a clean Next.js 16 app here that matches the proven
**Proposal Writer** pattern (`..\proposal-writer`, the comparative example) and
**transplant the proven engine + UI** into it. See `PORTING-SPEC.md` for the
step-by-step build plan and the verbatim IP to carry over.

## What it does

Compares a new NDA against the signed-in supervisor's **private library** of
past NDAs, then color-codes every clause by familiarity + negotiation history
and scores its legal risk. The two-pass comparison engine (extract clauses →
rank candidates → deep compare) is the core IP. Output: a per-clause breakdown
plus a summary (familiarity %, avg/max risk, category counts).

Six clause categories: **green** (agreed before), **yellow** (similar),
**red** (previously declined), **orange** (remediated before), **conflicted**
(found in both signed AND declined NDAs), **white** (new language).

## Hosting model (matches Proposal Writer)

- **Separate repo + own Vercel project**, a sibling of the-sandbox — NOT folded
  into the Sandbox repo. The Sandbox only gets a `lib/tools.ts` registry entry
  pointing at the deployed URL.
- **Auth.js v5 + Credentials**, reading the **same Upstash user store** as the
  Sandbox, so supervisors sign in with their existing Sandbox credentials and
  nobody else gets in. No self-signup, no register page, no access-key flow —
  all of that is deleted from the original app. Account creation / reset /
  change-password stay in the Sandbox.
- **Its own Anthropic Workspace + API key** with a spend limit (per-tool billing
  model). Key stays server-side only — never `NEXT_PUBLIC_`.

## Decisions locked (from scoping with Ryan)

1. **Hosting:** separate Vercel project, reusing Sandbox Auth.js. ✔
2. **Library scope:** per-supervisor **private** libraries (each user only sees
   and compares against their own NDAs) — same as the original app. ✔
3. **Data store:** **Upstash Redis** — drop Prisma/Postgres entirely. ✔
4. **Existing data:** **start fresh** — no migration from the old Supabase DB. ✔

## Decisions locked (round 2 — confirmed with Ryan)

5. **Branding:** **"NDA Analyzer"** (drop "Signalign" from all user-facing
   strings, the layout logo, metadata, and the registry tile). ✔
6. **Visual theme:** **match the Sandbox / Proposal Writer suite** — light shell,
   Geist Sans body + Space Grotesk display, Cornerstone navy/orange accent. Drop
   the original dark-slate theme. Copy proposal-writer's `globals.css` token set
   and `layout.tsx` font wiring. This is a full re-theme sweep of every page. ✔
7. **File input:** accept **PDF or DOCX** (plus paste). Parse both locally — PDF
   via `unpdf`/`pdfjs`, DOCX via `mammoth` (same as Proposal Writer). Claude is
   only a fallback for scanned/image PDFs with no text layer. Text-only storage
   (no original file bytes in Redis). ✔
8. **Model:** default **`claude-sonnet-4-6`** for the judgment-heavy deep-compare
   pass. **Use Haiku 4.5 for well-defined sub-prompts** (clause extraction is a
   structured-extraction task → Haiku candidate). Model tiering is now an
   intended optimization, not deferred. Both overridable via env. ✔

## Stack (target)

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Auth.js v5 (`next-auth@beta`), Credentials provider against Upstash
- Upstash Redis (`@upstash/redis`) — per-user NDA + analysis records
- `@anthropic-ai/sdk`, server-side only
- `bcryptjs` (password verify against shared user store)
- Vercel hosting (own project)

## Cost-saving strategy (bake into the engine — detail in spec)

Original cost profile is heavy: ~1 extraction call **+ 2 calls per clause**, and
PDFs were OCR'd by Claude. The rebuild bakes in: (1) **local PDF text parsing**,
Claude only for scanned PDFs; (2) **local candidate shortlisting** to remove the
per-clause "rank" LLM call; (3) **exact/near-duplicate short-circuit** (no API
call when a clause matches a library clause); (4) **analysis caching by document
hash**; (5) trimming/dedup of serialized context. Targets <15 calls for a
typical NDA vs ~41 today, no quality loss to the deep-compare pass.

## Project policies (inherited from the Sandbox)

- **No git writes by Claude.** Ryan reviews and commits/deploys everything
  manually. Claude provides commands; never runs `git commit/push/add`, never
  creates the Vercel project. Reading git state is fine.
- This folder is under **OneDrive sync** — overwriting files mid-sync can
  truncate them. After writing, verify size + last line, or pause sync.

## Current state

Pre-scaffold. This folder contains only the handoff docs (`CLAUDE.md`,
`PORTING-SPEC.md`). No code yet. Next session: execute the build order in
`PORTING-SPEC.md`.
