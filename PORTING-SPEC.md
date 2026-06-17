# NDA Analyzer — Porting Spec & Build Plan

Single source of truth for rebuilding the NDA Analyzer as a Sandbox-native tool.
Read `CLAUDE.md` first for context and locked decisions. This doc is the
executable plan: what to copy verbatim, the new Redis data layer, the engine +
cost optimizations, and the build order. Written to be handed to a fresh session.

## 0. Source locations

- **Original app (IP source):** `..\NDAnalyzer\nda-analyzer\` — "Signalign",
  Next 14 + NextAuth v4 + Prisma/Postgres. Engine + prompts + UI live here.
  The Vercel deployment is being decommissioned; the local folder remains the
  reference. Verbatim assets are also reproduced in this doc (appendix) so the
  build is self-contained.
- **Skeleton source (the proven pattern):** `..\proposal-writer\` — the most
  recent Sandbox-native AI tool. Copy its auth/redis/config wiring.
- **The Sandbox:** `..\the-sandbox\` — for `lib/tools.ts` registration and to
  confirm the user-record shape in Upstash.

## 1. Strategy: greenfield skeleton + IP transplant

We are NOT porting in place. We scaffold a clean app from the proposal-writer
skeleton and transplant the high-value, environment-agnostic pieces. The pieces
being discarded (NextAuth v4, Prisma, Supabase, landing/register/access-key) are
exactly the environment-specific layers we're replacing anyway.

**Transplant verbatim (the IP):** the prompts, the categorization + risk rules,
the taxonomy/constants, the data shapes, and the SSE two-pass engine structure.
**CRITICAL: do not rewrite the prompts.** They encode tested behavior (the
conflicted-category logic, the "no declined NDAs present → forbid red/conflicted"
guardrails, the risk rubric). Re-deriving them silently regresses quality.

## 2. Copy from proposal-writer VERBATIM (or near-verbatim)

These solved the exact auth/env/deploy problems and should be copied with only
cosmetic edits (names):

| File | Action |
|---|---|
| `auth.config.ts` | Copy as-is. Edge-safe; gates everything but `/signin`. Does NOT force change-password (Sandbox owns that). |
| `auth.ts` | Copy as-is. Credentials provider → `verifyCredentials` from `lib/users.ts`. |
| `proxy.ts` | Copy as-is. Same matcher gating all routes but `api/auth`, Next internals, favicon. |
| `lib/redis.ts` | Copy as-is. Points at the SAME Upstash DB as the Sandbox. |
| `lib/users.ts` | Copy as-is. Read-only view of the shared user store: `normalizeEmail`, `getUser`, `verifyCredentials`. |
| `types/next-auth.d.ts` | Copy as-is. Mirrors the `mustChangePassword` claim shape. |
| `app/api/auth/[...nextauth]/route.ts` | Copy as-is. |
| `lib/anthropic.ts` | Copy. Export TWO models: `MODEL` = `claude-sonnet-4-6` (deep compare) and `MODEL_FAST` = `claude-haiku-4-5` (well-defined sub-prompts like extraction). Both env-overridable (`ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_FAST`). |
| `next.config.ts` | Copy, then trim: drop the docx/template tracing + serverExternalPackages we don't use; keep `serverActions.bodySizeLimit: "15mb"` if we accept uploads via Server Actions (we likely use a route handler instead — see §5). |
| `tsconfig.json`, `postcss.config.mjs`, `.gitignore` | Copy as-is. |
| `.env.example` | Copy, then reconcile with §8. |
| `package.json` | New (see §3) — don't copy proposal-writer's deps wholesale. |

The Auth.js model: `session.user.id === session.user.email`. **The user's
identity key everywhere is their normalized email.** Replace the original's
`getSessionUser()` (which read `session.user.id` from a Postgres User row) with
Auth.js v5 `auth()` from `@/auth`, keyed on `normalizeEmail(session.user.email)`.

## 3. Dependencies

```jsonc
// dependencies
"@anthropic-ai/sdk": "^0.70.0",
"@upstash/redis": "^1.38.0",
"next-auth": "^5.0.0-beta.31",
"bcryptjs": "^3.0.3",
"next": "16.2.6",
"react": "19.2.4",
"react-dom": "19.2.4",
"lucide-react": "^0.5xx",     // icons (original uses it heavily)
"sonner": "^2.0.7",           // toasts (original uses it)
"unpdf": "^0.x",              // LOCAL pdf text extraction (cost opt #1)
"mammoth": "^1.8.0",          // LOCAL docx text extraction (PDF-or-DOCX input)
"geist": "^1.7.2",            // Geist Sans body font (Sandbox theme)
// Space Grotesk display font comes from next/font/google — no dep needed.
// devDependencies
"@tailwindcss/postcss": "^4", "tailwindcss": "^4",
"@types/bcryptjs", "@types/node", "@types/react", "@types/react-dom",
"eslint": "^9", "eslint-config-next": "16.2.6", "typescript": "^5"
```

Dropped vs original: `@prisma/client`, `prisma`, `next-auth@4`, `framer-motion`,
Supabase libs. Keep `class-variance-authority`/`clsx`/`tailwind-merge` only if
retaining the shadcn ui primitives (§7); otherwise drop them too. `next.config.ts`
should mark `mammoth` (and `unpdf` if it complains) as
`serverExternalPackages` so they aren't bundled.

## 4. Redis data model (replaces Prisma)

Tiny scale, per-user, private. Follow the Sandbox convention: store records as
JSON, keep a per-user index, load + filter/sort in JS. Identity key = normalized
email. IDs via `crypto.randomUUID()` (replaces Prisma `cuid()`).

**Keys**
- `nda:<id>` → `StoredNDA` JSON (includes `ownerEmail`)
- `nda:ids:<email>` → Redis set of NDA ids owned by that user
- `analysis:<id>` → `StoredAnalysis` JSON (includes `ownerEmail`)
- `analysis:ids:<email>` → Redis set of analysis ids owned by that user

**`lib/ndaStore.ts`** (server-only)
```
listNdas(email): Promise<StoredNDA[]>            // smembers → mget → sort by dateAdded desc
getNda(email, id): Promise<StoredNDA | null>     // get; return null if ownerEmail !== email
createNda(email, input): Promise<StoredNDA>      // uuid; set nda:<id>; sadd nda:ids:<email>
deleteNda(email, id): Promise<boolean>           // ownership check; del + srem
```

**`lib/analysisStore.ts`** (server-only)
```
listAnalyses(email): Promise<AnalysisSummaryRow[]>   // omit heavy `results` for the list view
getAnalysis(email, id): Promise<StoredAnalysis | null>
createAnalysis(email, input): Promise<StoredAnalysis>
deleteAnalysis(email, id): Promise<boolean>
```

**Ownership rule:** every get/delete loads the record and verifies
`record.ownerEmail === normalizeEmail(sessionEmail)` before returning/acting —
this replaces Prisma's `where: { userId }` scoping and is what keeps libraries
private. The original CRUD routes to translate are in
`..\NDAnalyzer\nda-analyzer\src\app\api\ndas\` and `\analyses\`.

Record shapes are the original `types/index.ts` shapes (§ Appendix B) minus
`userId` (replaced by `ownerEmail`) and with `id`/`dateAdded`/`createdAt` set by
the store. Drop the `fileUrl` field unless we keep PDF storage.

## 5. The engine + cost optimizations

The engine is the original `src/app/api/analyze/route.ts` (SSE streaming, two
passes). Port its structure and **prompts verbatim** (Appendix A), but rewire
persistence to `analysisStore`/`ndaStore` and bake in the cost optimizations.

### Current flow (per analysis)
1. Extract clauses from the incoming NDA text (1 Claude call).
2. For each clause: **Pass 1 rank** (1 Claude call — pick top-5 similar library
   clauses) → **Pass 2 deep compare** (1 Claude call — categorize + risk).
3. Compute summary (familiarity %, avg/max risk, category counts) and save.

So ~`1 + 2N` calls for N clauses (≈41 for a 20-clause NDA). Library candidates
are re-serialized into every rank prompt.

### Optimizations to bake in (locked direction: all-in on #1–#5)

**#1 — Local file parsing (PDF + DOCX).** Replace the original `api/ai/extract-text`
(which base64'd the whole PDF into a Claude `document` call) with a local
`lib/extractText.ts`: PDF via `unpdf`/`pdfjs`, DOCX via `mammoth.extractRawText`.
Only fall back to a Claude vision call when a PDF's text layer is empty
(scanned/image PDF) — DOCX never needs Claude. Accept `.pdf` and `.docx` (plus
paste) on BOTH the analyze upload and the library "add" upload; update the
`PdfUpload` component's `accept` + label to "Upload PDF or Word".

**#2 — Local candidate shortlisting (removes the rank LLM call).** Replace Pass 1
with a JS similarity rank: filter by `clauseType` (already done), then score
candidates by token-Jaccard / TF-IDF cosine against the clause, take top 5. The
deep-compare pass (Pass 2) is unchanged. Cuts per-clause calls 2N → N.

**#3 — Exact / near-duplicate short-circuit (no API call).** Before any LLM call
for a clause, normalize (lowercase, collapse whitespace, strip punctuation) and
compare to library clauses. On exact or ≥~95% lexical overlap, derive the verdict
from the matched NDA's status (signed→green, declined→red, both→conflicted,
remediated-original→orange) and skip Claude entirely for that clause. Reuse the
category rules in Appendix A so deterministic verdicts match LLM ones.

**#4 — Analysis cache by document hash.** Hash `normalize(text)` +
a library fingerprint (e.g. sorted list of `nda:<id>` + their updatedAt). On a
hit, return the stored analysis id immediately instead of re-running. Store the
hash on the analysis record; check it at the top of `POST /api/analyze`.

**#5 — Trim + dedup serialized context.** Cap deep-compare match text (~800
chars), dedup near-identical library clauses before building the candidate list,
and replace the silent `text.slice(0, 8000)` truncation on extraction with
chunking that doesn't drop clauses on long NDAs.

**#6 — Model tiering (active).** Route well-defined, structured-output sub-prompts
to **Haiku 4.5** (`MODEL_FAST`) and keep the judgment-heavy **deep-compare** pass
on **Sonnet 4.6** (`MODEL`). Concretely: clause **extraction** → Haiku (it's
strict JSON extraction); deep compare → Sonnet; the rank pass is gone (cost opt
#2 does it locally). `callClaude` should take a `model` arg so each call picks its
tier. Validate Haiku's extraction quality against the example NDAs before locking.

**Later (not first cut):** prompt caching on any stable prefix (`cache_control`).

### SSE contract (keep — the client depends on it)
Events are `data: {json}\n\n`. Shapes the client (`analyze/page.tsx`) reads:
`{ progress: { cur, tot, msg } }`, `{ analysisId, complete: true }`,
`{ error: string }`. Keep these exact keys so the ported client works unchanged.

## 6. Auth seam changes (original → target)

- Delete: `src/app/page.tsx` landing, `src/app/login`, `src/app/register`,
  `src/app/api/auth/register`, `src/app/api/access-key`, `AccessKeyModal`,
  `AuthProvider` (NextAuth v4 SessionProvider), `src/lib/auth.ts` (v4 options),
  `src/lib/auth-helpers.ts`, `src/lib/prisma.ts`, `prisma/`.
- The original app lived under `/app/*` (route group `app/app/...`) because `/`
  was the marketing site. In the Sandbox-native version there is no marketing
  site — move the tool to the root. Recommended routes: `/` (dashboard),
  `/library`, `/library/add`, `/library/[id]`, `/analyze`, `/results/[id]`,
  `/playbook`, `/signin`. Update all `Link`/`router.push` targets accordingly
  (originals point at `/app/...`).
- `layout.tsx` sidebar uses `useSession`/`signOut` from `next-auth/react`. In v5
  this still works client-side, but the simplest path is a server layout that
  reads `auth()` and passes the email down, with a small client `signOut` button.
  Either is fine; keep the sidebar nav + the six items.

## 7. Page & component inventory

Port these from `..\NDAnalyzer\nda-analyzer\src` (rewire routes per §6):

| Item | Keep? | Notes |
|---|---|---|
| `app/analyze/page.tsx` | ✔ | Main flow. Reads SSE; keep contract (§5). Repoint `/api/*` + `/app/*`. |
| `app/results/[id]/page.tsx` | ✔ | Summary card + clause-by-clause. Heaviest UI; pure render of `Analysis`. |
| `app/library/page.tsx`, `library/add/page.tsx`, `library/[id]/page.tsx` | ✔ | Add flow extracts clauses (cost opt #1/#5 apply); supports original-vs-final versions for remediated statuses. |
| `app/history/page.tsx` | ✔ | List of past analyses → results. |
| `app/playbook/page.tsx` | ✔ | Static-ish insights view; port as-is, verify it has no Prisma import. |
| `app/page.tsx` (dashboard) | ✔ | Was `app/app/page.tsx`. |
| `app/layout.tsx` (sidebar) | ✔ | See §6 auth note. |
| `components/app/RiskMeter, ClauseTag, StatusBadge, PdfUpload, ErrorBoundary` | ✔ | Small. PdfUpload → accept PDF+DOCX, hit the local-parse route, relabel "Upload PDF or Word". Re-theme to light (see below). |
| `components/ui/*` (button, card, input, label, skeleton) | ✔* | shadcn primitives. Keep if also keeping `cn`/clsx/tailwind-merge; otherwise use proposal-writer's `.btn-primary`/`.field`/`.card` component utilities. |
| `lib/constants.ts` | ✔ | Taxonomy — copy verbatim (Appendix C). |
| `lib/utils.ts` (`cn`) | ✔* | Only if keeping ui primitives. |
| `globals.css` | replace | Use proposal-writer's token set (below), NOT the original dark-slate tokens. |

**Visual theme (LOCKED — match the Sandbox / Proposal Writer suite).** Adopt the
light hybrid look. This is a full sweep across every page + component.
- **Fonts (in `app/layout.tsx`):** `GeistSans` from `geist/font/sans` as body
  (`--font-geist-sans`), `Space_Grotesk` from `next/font/google` as display
  (`--font-display`); apply `.font-display` to page `<h1>`/headings. Metadata
  title → "NDA Analyzer — Cornerstone".
- **`globals.css`:** copy proposal-writer's tokens verbatim — navy `#14323f`
  (+`#1d4a5e`), orange `#e8742c` (+`#d4641f`), shell `--background #fafaf9`,
  `--foreground #1b2733`, `--card #fff`, `--border #e7e5e4`, `--muted #78716c`;
  the `@theme inline` block; orange focus ring; `animate-fade-up`; and the
  `@layer components` utilities (`.card`, `.field`, `.label`, `.btn-primary`,
  `.btn-secondary`, `.pill`).
- **Sweep:** replace dark-slate classes throughout — `bg-slate-950/900` shells →
  `--background`/`.card`; `text-white`/`text-slate-300` → `--foreground`/navy;
  blue accents (`text-blue-400`, `bg-blue-600`) → Cornerstone orange/navy; the
  sidebar logo "Signalign" → "NDA Analyzer".
- **Category COLORS (constants.ts):** keep the six light clause-card backgrounds
  (emerald/yellow/red/orange/purple/gray) — they already read on a light shell
  and carry semantic meaning; only the dark page chrome changes.

## 8. Environment variables

```
# Anthropic (own Workspace, server-side only)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6        # deep-compare pass (lib/anthropic MODEL)
ANTHROPIC_MODEL_FAST=claude-haiku-4-5    # well-defined sub-prompts, e.g. extraction (MODEL_FAST)

# Auth.js — this tool's own session secret (fresh, need NOT match the Sandbox)
AUTH_SECRET=

# Upstash Redis — SAME values as the Sandbox (shared user store + our records)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
No `DATABASE_URL`, no Supabase, no `BLOB_READ_WRITE_TOKEN` (unless PDF storage is
kept → add Blob like the Datacenter Hub).

## 9. Build order (for the next session)

1. `npm init` / scaffold; add deps (§3); copy config + auth + redis + users from
   proposal-writer (§2). Confirm `next build` + `tsc` clean on the skeleton with a
   placeholder `/` page behind the proxy.
2. Add `lib/constants.ts`, `types` (§Appendix B/C), `lib/anthropic.ts`.
3. Build `lib/ndaStore.ts` + `lib/analysisStore.ts` (§4).
4. Build `lib/extractText.ts` (local PDF+DOCX, cost opt #1) and `lib/similarity.ts`
   (cost opt #2/#3 helpers: normalize, hash, jaccard/cosine, deriveVerdict).
5. Port API routes onto the stores: `ndas`, `ndas/[id]`, `analyses`,
   `analyses/[id]`, `ai/extract-clauses` (on Haiku/`MODEL_FAST`), the local
   file-parse route, and the streaming `analyze` route with #2–#6 baked in
   (deep compare on Sonnet/`MODEL`). Keep the SSE contract (§5).
6. Port pages + components (§7); repoint routes (§6); wire layout auth.
7. Re-theme to the Sandbox hybrid (§7 LOCKED): fonts in `layout.tsx`, copy
   proposal-writer `globals.css` tokens, sweep dark-slate → light/navy/orange,
   rename "Signalign" → "NDA Analyzer" in the logo + metadata.
8. `tsc` + `next build` + lint clean. Manual run-through with the example NDAs in
   `..\NDAnalyzer\example-ndas`.
9. Handoff to Ryan: git init + GitHub repo, Vercel project, set the four env vars,
   create the Anthropic Workspace + spend limit + key, deploy. Then add the
   registry entry (§10) to the Sandbox and redeploy it.

## 10. Sandbox registry entry (Ryan commits this to the-sandbox)

Add to `..\the-sandbox\lib\tools.ts` `tools[]` (mirror the `proposal-writer`
entry). Note: the original "Signalign" was never in the registry, so this is a
**new entry**, not an edit.
```ts
{
  id: "nda-analyzer",
  name: "NDA Analyzer",
  description:
    "Compares a new NDA against your private library of past agreements — "
    + "color-codes each clause by familiarity and negotiation history, and scores legal risk.",
  status: "demo-live",
  kind: "web",
  href: "https://<deployed-url>.vercel.app",
  updatedAt: "<ISO date>",
  notes: "Live — sign in with your Sandbox credentials. Per-user private library.",
}
```

## 11. Deploy gotchas (learned from Proposal Writer)

- Vercel blocks commits authored by a stale git identity. Author commits as
  `rkernal` (Ryan's current identity), not an old one.
- Set ALL four env vars on Vercel (Production + Preview) before first deploy.
- Confirm the auth gate post-deploy: unauthenticated `/` should 307 → `/signin`.
- `npm run build` must pass locally first (`tsc` + `next build`).

---

# Appendix A — Prompts (copy WITH the improvements below)

Canonical source: `..\NDAnalyzer\nda-analyzer\src\app\api\analyze\route.ts`
(lines 16–101) and `src\app\api\ai\extract-clauses\route.ts`. The original text is
preserved here as REFERENCE; the **Improvements** subsections are what to actually
build. The load-bearing logic (dynamic guardrails, conflicted-priority rule, risk
rubric) is preserved unchanged — the changes are a bug fix, two cross-cutting
reliability wins, a stronger extraction prompt, and three surgical deep-compare
tightenings. Validate the extraction-on-Haiku and any wording changes against
`..\NDAnalyzer\example-ndas` before locking.

## A.0 🔴 BUG TO FIX — status-string mismatch kills orange/red

In the original deep-compare setup (`route.ts:92–94`) the guardrail booleans
compare against **underscore** status values, but statuses are stored
**hyphenated** (`constants.ts` / the add form):
```ts
// ORIGINAL (buggy):
const hasDeclined   = topCandidates.some(c => c.ndaStatus === "declined" || c.ndaStatus === "declined_remediated");
const hasRemediated = topCandidates.some(c => c.ndaStatus === "signed_remediated" && c.version === "original");
```
Effect: `"signed_remediated"`/`"declined_remediated"` never match the stored
`"signed-remediated"`/`"declined-remediated"`, so `hasRemediated` is **always
false** (the prompt always forbids `orange` → orange can never be assigned) and
`hasDeclined` misses declined-remediated NDAs (wrongly forbids red/conflicted when
the only "no" evidence is a walked-away negotiation).
```ts
// FIXED — use the hyphenated stored values (better: a shared STATUS enum so it can't drift):
const hasDeclined   = topCandidates.some(c => c.ndaStatus === "declined" || c.ndaStatus === "declined-remediated");
const hasRemediated = topCandidates.some(c => c.ndaStatus === "signed-remediated" && c.version === "original");
```
Note the `deriveVerdict` helper for cost-opt #3 must use the SAME hyphenated
values so deterministic verdicts agree with the LLM's.

## A.1 Cross-cutting (apply to EVERY call)

1. **Force JSON via tool use, drop the regex strip.** Originals end with "Respond
   ONLY with JSON" and the code strips ```` ```json ```` fences + `JSON.parse`s with
   a malformed-JSON fallback. Replace with the SDK's `tools` + `tool_choice`
   (forced tool) so the schema is guaranteed — same pattern Proposal Writer uses.
   Removes the cleaning regex and the "Malformed JSON from Claude" failure path;
   matters most for extraction on **Haiku**. With forced tool use, the "respond
   only with JSON" sentences become unnecessary.
2. **Low temperature (0–0.2) on all calls.** Originals run at the 1.0 default.
   Classification, segmentation, and categorization want consistency — and the
   same extraction prompt runs on both library and incoming NDAs, so stable
   segmentation across the two directly improves match quality.

## A.2 Clause extraction — IMPROVED (run on `MODEL_FAST` / Haiku)

Original (reference):
> Extract all distinct clauses/provisions from this NDA. For each clause, provide
> a short title, the full text, and classify its type. / Clause types: … /
> Respond ONLY with JSON: {"clauses":[{"title","text","clauseType"}]} / NDA TEXT: …

Build THIS instead (adds verbatim-copy, granularity, and a non-NDA escape — the
two gaps that most hurt matching downstream):
> Extract every distinct operative clause/provision from this NDA. Copy each
> clause's text **verbatim** — do not paraphrase, summarize, or fix typos. Split at
> the level of individually negotiable provisions: one numbered section or
> sub-section with a distinct legal effect = one clause. Do not merge unrelated
> provisions, and do not split a single provision mid-sentence. Give each a short
> descriptive title and classify its type (pick the single dominant type if
> several apply).
>
> Clause types: non-compete, non-solicit, confidentiality, term-duration,
> governing-law, remedies, definition, scope, exclusions, ip-ownership,
> indemnification, termination, dispute-resolution, injunctive-relief,
> return-of-materials, assignment, severability, other
>
> If the text is not an NDA or has no recognizable clauses, return an empty list.
>
> NDA TEXT:
> `{text}`

(Output `{clauses:[{title,text,clauseType}]}` via forced tool use, not a "respond
only with JSON" line.) **Also fix the silent `text.slice(0, 8000)` truncation**
(cost-opt #5) — chunk so long NDAs don't lose their tail clauses.

## A.3 Pass 1 rank — DEPRECATED (replaced by local similarity, cost-opt #2)

Original system: *"You are a legal document similarity ranker. Return ONLY valid
JSON. Pick up to 5 indices … empty array if none."* User prompt: condensed
candidate list → `{"topMatches":[…],"reasoning":"…"}`.

Cost-opt #2 does this in JS (clauseType filter + Jaccard/TF-IDF). **Tradeoff:**
lexical overlap is weaker than the LLM's semantic match and can miss
same-meaning/different-words clauses. Keep this prompt as a documented fallback:
if match recall looks thin against the example NDAs, run the ranker on
**`MODEL_FAST` / Haiku** (well-defined task, fits the tiering plan) rather than
reintroducing a Sonnet call.

## A.4 Pass 2 deep compare — KEEP, with 3 surgical fixes (do not rewrite)

Preserve verbatim: the two DYNAMIC guardrails (now fed by the FIXED booleans from
A.0), the categorization rules, the status context, the conflicted-priority rule,
and the riskScore 1–10 rubric (scope breadth, duration, one-sidedness, ambiguity,
penalty severity, jurisdiction, deviation from norms).

DYNAMIC guardrails (injected based on the candidate set — essential):
- No declined NDAs present → *"⚠️ CRITICAL: There are NO declined NDAs in these
  matches. You MUST NOT use category 'red' or 'conflicted' … reflect aggression in
  a higher riskScore, NOT the category."*
- No remediated-with-original NDAs present → *"⚠️ CRITICAL: There are NO
  remediated NDAs (with original versions) in these matches. You MUST NOT use
  category 'orange' …"*

The 3 fixes:
1. **Resolve the red/orange overlap.** The original `red` rule lists "original
   drafts that were negotiated away," but `orange` also claims original drafts —
   ambiguous. Tighten `red` to: *"Matches language ONLY found in previously
   DECLINED NDAs, declined-remediated NDAs (both the original and the last version
   before walking away), or originals from a DECLINED negotiation. Not present in
   any signed NDA."* Rule of thumb to bake in: original-draft language is
   **orange** if it came from something ultimately **signed**, **red** if from
   something **declined**.
2. **Define `confidence`** (currently requested but unanchored): *"confidence =
   how closely the matched library language aligns; 1.0 = near-identical match,
   lower = looser or inferred."* (Or drop the field if not surfaced in the UI — it
   is shown on the results page, so keep + define it.)
3. **Grounding line** (add to system/persona): *"Base every categorization ONLY on
   the provided library matches. Never invent a match or cite an NDA not listed."*

Output JSON shape (unchanged; emit via forced tool use):
> {"category", "confidence" 0.0-1.0, "explanation", "matchedNda"|null,
> "matchedClause"|null, "suggestedAlternative"|null, "riskScore" 1-10,
> "riskReasoning", "agreedIn"|null, "declinedIn"|null, "conflictNote"|null}

Optional (feature call, not a prompt fix): also return `suggestedAlternative` for
`red`/`conflicted`, not just `orange` — you often know what you accepted elsewhere.

Copy the full exact category-rule / status-context / rubric strings from the
source file; the above are the deltas, not a replacement.

# Appendix B — Data shapes (from original `types/index.ts`)

Keep these shapes. Replace `userId` with `ownerEmail`; `id`/`dateAdded`/
`createdAt` are set by the store.

- **Clause:** `{ title, text, clauseType }`
- **NDA:** `{ id, ownerEmail, name, status, rawText, originalRawText?, dateAdded,
  clauses: Clause[], originalClauses?: Clause[] | null }` (drop `fileUrl` unless
  keeping PDF storage). `status` ∈ `signed-asis | signed-remediated | declined |
  declined-remediated`.
- **AnalysisResult:** `{ title, text, clauseType, category, confidence,
  explanation, riskScore, riskReasoning, matchedNda?, matchedClause?,
  suggestedAlternative?, agreedIn?, declinedIn?, conflictNote? }`
- **AnalysisSummary:** `{ green, yellow, red, orange, conflicted, white }` (counts)
- **Analysis:** `{ id, ownerEmail, ndaName, rawText, createdAt, summary, results:
  AnalysisResult[], familiarityPct, avgRiskScore, maxRiskScore, libSnapshot:
  { ndaCount, clauseCount }, docHash }` (`docHash` is new, for cost opt #4).

Summary math (from the engine): `familiarityPct = ((green + yellow*0.5) / N)*100`;
`avgRiskScore` = mean of clause riskScores (1 dp); `maxRiskScore` = max.

# Appendix C — Taxonomy / constants

Copy `..\NDAnalyzer\nda-analyzer\src\lib\constants.ts` verbatim: `COLORS` (6
categories + labels), `STATUS_LABELS`, `STATUS_COLORS`, `CLAUSE_TYPES` (18 types
with label+color), `CATEGORY_ORDER` (red, conflicted, white, orange, yellow,
green — the results sort order). These drive RiskMeter/ClauseTag/StatusBadge and
the results page; if the visual theme changes, the COLORS light backgrounds for
clause cards may need adjusting but the keys/labels stay.
