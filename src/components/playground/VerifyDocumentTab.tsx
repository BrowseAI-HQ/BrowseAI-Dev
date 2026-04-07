import { useState } from "react";
import { Loader2, FileCheck2, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browseVerifyDocument, type VerifyDocumentResult } from "@/lib/api/browse";

const EXAMPLE_REPORT = `Apple announced the iPhone 15 in September 2023, featuring USB-C port replacing the Lightning connector. OpenAI released GPT-4o in May 2024 with native multimodal capabilities. Anthropic released Claude 3.5 Sonnet in October 2023. Python 3.12 removed the GIL.`;

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  D: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  F: "text-red-400 bg-red-400/10 border-red-400/30",
};

const STATUS_META = {
  verified: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/5 border-emerald-400/20", label: "Verified" },
  contradicted: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/5 border-red-400/20", label: "Contradicted" },
  unverified: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/20", label: "Unverified" },
} as const;

export function VerifyDocumentTab() {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [depth, setDepth] = useState<"fast" | "thorough">("fast");
  const [maxClaims, setMaxClaims] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyDocumentResult | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await browseVerifyDocument({
        text: mode === "text" ? text : undefined,
        url: mode === "url" ? url : undefined,
        title: title || undefined,
        depth,
        maxClaims,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canRun = !loading && (mode === "text" ? text.trim().length >= 50 : url.trim().length > 0);

  return (
    <div className="space-y-4 mt-4">
      {/* Input mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("text")}
          className={`px-3 py-1.5 text-xs rounded-md font-mono transition-all ${mode === "text" ? "bg-accent/15 text-accent border border-accent/30" : "bg-secondary border border-border text-muted-foreground"}`}
        >
          Paste Text
        </button>
        <button
          onClick={() => setMode("url")}
          className={`px-3 py-1.5 text-xs rounded-md font-mono transition-all ${mode === "url" ? "bg-accent/15 text-accent border border-accent/30" : "bg-secondary border border-border text-muted-foreground"}`}
        >
          Fetch URL
        </button>
      </div>

      {/* Title (optional) */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title (optional)"
        className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
      />

      {/* Content input */}
      {mode === "text" ? (
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a report, competitive analysis, news article, or any document you want fact-checked. Minimum 50 characters."
            rows={10}
            className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          />
          <div className="text-[10px] text-muted-foreground/60 mt-1 text-right">
            {text.length} chars {text.length < 50 && <span className="text-amber-400">(min 50)</span>}
          </div>
          <button
            onClick={() => setText(EXAMPLE_REPORT)}
            className="mt-2 text-xs text-accent hover:underline"
            type="button"
          >
            Try example report →
          </button>
        </div>
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article-or-report"
          className="w-full h-12 px-4 rounded-lg bg-secondary border border-border text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      )}

      {/* Options */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 bg-secondary rounded-md p-0.5 border border-border">
          {(["fast", "thorough"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-3 py-1 text-xs rounded font-mono ${depth === d ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md border border-border">
          <span className="text-[10px] text-muted-foreground font-mono">claims</span>
          <input
            type="number"
            min={1}
            max={20}
            value={maxClaims}
            onChange={(e) => setMaxClaims(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-12 bg-transparent text-xs font-mono text-foreground focus:outline-none"
          />
        </div>
        <Button
          onClick={handleRun}
          disabled={!canRun}
          className="bg-accent text-accent-foreground h-9 px-5 ml-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck2 className="w-4 h-4 mr-2" />}
          {loading ? "Verifying…" : "Verify Document"}
        </Button>
      </div>

      {/* Loading hint */}
      {loading && (
        <div className="p-4 rounded-lg border border-border bg-card text-xs text-muted-foreground">
          Extracting claims and verifying each against live web sources. This typically takes 10-60s depending on document size.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg border border-red-400/30 bg-red-400/5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                {result.title && <div className="text-xs text-muted-foreground mb-1">{result.title}</div>}
                <div className="text-sm font-bold">Verification Report</div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {result.documentLength} chars · {(result.durationMs / 1000).toFixed(1)}s
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg border text-3xl font-bold font-mono ${GRADE_COLORS[result.summary.grade]}`}>
                {result.summary.grade}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Stat label="Verified" value={result.summary.verified} total={result.summary.totalClaims} color="emerald" />
              <Stat label="Contradicted" value={result.summary.contradicted} total={result.summary.totalClaims} color="red" />
              <Stat label="Unverified" value={result.summary.unverified} total={result.summary.totalClaims} color="yellow" />
              <Stat label="Confidence" value={`${Math.round(result.summary.overallConfidence * 100)}%`} color="accent" />
            </div>
          </div>

          {/* Per-claim breakdown */}
          <div className="space-y-2">
            {result.claims.map((claim, i) => {
              const meta = STATUS_META[claim.status];
              const Icon = meta.icon;
              return (
                <div key={i} className={`p-4 rounded-lg border ${meta.bg}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-snug">{claim.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                        <span>·</span>
                        <span>{Math.round(claim.confidence * 100)}% confidence</span>
                        {claim.nli && (
                          <>
                            <span>·</span>
                            <span className="font-mono">
                              NLI: ent {claim.nli.entailment.toFixed(2)} / con {claim.nli.contradiction.toFixed(2)} / neu {claim.nli.neutral.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                      {claim.topSource && (
                        <div className="mt-2 p-2 rounded bg-background/50 border border-border/50">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                            <span className="font-mono">{claim.topSource.domain}</span>
                            <a href={claim.topSource.url} target="_blank" rel="noopener" className="hover:text-accent">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="text-[11px] text-foreground/80 italic line-clamp-3">
                            "{claim.topSource.quote}"
                          </div>
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/60 mt-1.5">{claim.reason}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, total, color }: { label: string; value: number | string; total?: number; color: string }) {
  const colorClass: Record<string, string> = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    accent: "text-accent",
  };
  return (
    <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
      <div className={`text-lg font-bold font-mono ${colorClass[color]}`}>
        {value}
        {total !== undefined && <span className="text-xs text-muted-foreground/60">/{total}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
