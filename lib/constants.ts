export const COLORS: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  green: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", badge: "bg-emerald-500", label: "Agreed Before" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-700", badge: "bg-yellow-500", label: "Similar" },
  red: { bg: "bg-red-50", border: "border-red-400", text: "text-red-700", badge: "bg-red-500", label: "Previously Declined" },
  orange: { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-700", badge: "bg-orange-500", label: "Remediated Before" },
  conflicted: { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", badge: "bg-purple-500", label: "Conflicted" },
  white: { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700", badge: "bg-gray-400", label: "New Language" },
};

export const STATUS_LABELS: Record<string, string> = {
  "signed-asis": "Signed (As-Is)",
  "signed-remediated": "Signed (Remediated)",
  "declined": "Declined",
  "declined-remediated": "Declined (Remediated)",
};

export const STATUS_COLORS: Record<string, string> = {
  "signed-asis": "bg-emerald-100 text-emerald-800",
  "signed-remediated": "bg-orange-100 text-orange-800",
  "declined": "bg-red-100 text-red-800",
  "declined-remediated": "bg-rose-100 text-rose-800",
};

export const CLAUSE_TYPES: Record<string, { label: string; color: string }> = {
  "non-compete": { label: "Non-Compete", color: "bg-purple-100 text-purple-800" },
  "non-solicit": { label: "Non-Solicit", color: "bg-pink-100 text-pink-800" },
  "confidentiality": { label: "Confidentiality", color: "bg-blue-100 text-blue-800" },
  "term-duration": { label: "Term/Duration", color: "bg-cyan-100 text-cyan-800" },
  "governing-law": { label: "Governing Law", color: "bg-indigo-100 text-indigo-800" },
  "remedies": { label: "Remedies", color: "bg-rose-100 text-rose-800" },
  "definition": { label: "Definition", color: "bg-slate-200 text-slate-700" },
  "scope": { label: "Scope", color: "bg-teal-100 text-teal-800" },
  "exclusions": { label: "Exclusions", color: "bg-lime-100 text-lime-800" },
  "ip-ownership": { label: "IP/Ownership", color: "bg-amber-100 text-amber-800" },
  "indemnification": { label: "Indemnification", color: "bg-red-100 text-red-800" },
  "termination": { label: "Termination", color: "bg-orange-100 text-orange-800" },
  "dispute-resolution": { label: "Dispute Resolution", color: "bg-violet-100 text-violet-800" },
  "injunctive-relief": { label: "Injunctive Relief", color: "bg-fuchsia-100 text-fuchsia-800" },
  "return-of-materials": { label: "Return of Materials", color: "bg-emerald-100 text-emerald-800" },
  "assignment": { label: "Assignment", color: "bg-sky-100 text-sky-800" },
  "severability": { label: "Severability", color: "bg-gray-200 text-gray-700" },
  "other": { label: "Other", color: "bg-gray-100 text-gray-700" },
};

export const CATEGORY_ORDER: Record<string, number> = {
  red: 0,
  conflicted: 1,
  white: 2,
  orange: 3,
  yellow: 4,
  green: 5,
};
