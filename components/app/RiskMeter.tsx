export function RiskMeter({ score, size = "full" }: { score: number; size?: "sm" | "full" }) {
  const s = Math.max(1, Math.min(10, score || 1));
  const cm = {
    lo: { bar: "bg-emerald-500", txt: "text-emerald-600", bg: "bg-emerald-50", lb: "Low" },
    md: { bar: "bg-yellow-500", txt: "text-yellow-600", bg: "bg-yellow-50", lb: "Moderate" },
    hi: { bar: "bg-orange-500", txt: "text-orange-600", bg: "bg-orange-50", lb: "High" },
    cr: { bar: "bg-red-500", txt: "text-red-600", bg: "bg-red-50", lb: "Critical" },
  };
  const c = s <= 3 ? cm.lo : s <= 5 ? cm.md : s <= 7 ? cm.hi : cm.cr;

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 bg-stone-200 rounded-full h-1.5">
          <div className={c.bar + " h-1.5 rounded-full"} style={{ width: s * 10 + "%" }} />
        </div>
        <span className={c.txt + " text-xs font-bold"}>{s}</span>
      </div>
    );
  }

  return (
    <div className={c.bg + " rounded-lg p-3"}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[var(--muted)]">Risk Level</span>
        <span className={c.txt + " text-sm font-bold"}>{s}/10 — {c.lb}</span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-2.5 flex">
        {Array.from({ length: 10 }, (_, i) => {
          let cls = "flex-1 h-2.5 ";
          if (i === 0) cls += "rounded-l-full ";
          if (i === 9) cls += "rounded-r-full ";
          if (i < s) cls += c.bar + (i < 9 ? " border-r border-white/40" : "");
          else cls += "bg-stone-200";
          return <div key={i} className={cls} />;
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[var(--muted)]">Standard</span>
        <span className="text-xs text-[var(--muted)]">Aggressive</span>
      </div>
    </div>
  );
}
