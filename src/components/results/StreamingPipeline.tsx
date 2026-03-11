import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, Globe, FileText, Brain, Shield, GitMerge, Sparkles, Search } from "lucide-react";
import type { TraceEvent, SourcePreview } from "@/lib/api/stream";

const STEP_ICONS: Record<string, React.ReactNode> = {
  "Searching": <Search className="w-4 h-4" />,
  "Search Web": <Globe className="w-4 h-4" />,
  "Query Plan": <Brain className="w-4 h-4" />,
  "Fetching": <FileText className="w-4 h-4" />,
  "Fetch Pages": <FileText className="w-4 h-4" />,
  "Analyzing": <Brain className="w-4 h-4" />,
  "Extract Claims": <Brain className="w-4 h-4" />,
  "Verify Evidence": <Shield className="w-4 h-4" />,
  "Cross-Source Consensus": <GitMerge className="w-4 h-4" />,
  "Build Evidence Graph": <Globe className="w-4 h-4" />,
  "Generate Answer": <Sparkles className="w-4 h-4" />,
  "Cache Hit": <CheckCircle2 className="w-4 h-4" />,
};

// Steps that are "in-progress" indicators (duration_ms = 0, emitted before the real step)
const PROGRESS_STEPS = new Set(["Searching", "Fetching", "Analyzing"]);

interface Props {
  steps: TraceEvent[];
  sources: SourcePreview[];
  done: boolean;
}

export function StreamingPipeline({ steps, sources, done }: Props) {
  // Filter out in-progress indicator steps once the real step arrives
  const displaySteps = steps.filter((step) => {
    if (PROGRESS_STEPS.has(step.step) && step.duration_ms === 0) {
      // Keep it only if the corresponding real step hasn't arrived yet
      const realStepMap: Record<string, string> = {
        "Searching": "Search Web",
        "Fetching": "Fetch Pages",
        "Analyzing": "Extract Claims",
      };
      const realName = realStepMap[step.step];
      return !steps.some((s) => s.step === realName);
    }
    return true;
  });

  const lastStep = displaySteps[displaySteps.length - 1];
  const isActive = (step: TraceEvent) =>
    step === lastStep && !done && step.duration_ms === 0;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Main progress indicator */}
      {!done && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <div className="absolute inset-0 w-8 h-8 rounded-full bg-accent/10 animate-ping" />
          </div>
          {lastStep && (
            <motion.p
              key={lastStep.step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-accent"
            >
              {lastStep.step}...
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Step timeline */}
      <div className="w-full max-w-md space-y-1">
        <AnimatePresence mode="popLayout">
          {displaySteps.map((step, i) => {
            const active = isActive(step);
            const completed = !active && (step.duration_ms > 0 || done);
            const icon = STEP_ICONS[step.step] || <Circle className="w-4 h-4" />;

            return (
              <motion.div
                key={`${step.step}-${i}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg">
                  {/* Status icon */}
                  <div className={`shrink-0 ${
                    completed ? "text-emerald-400" :
                    active ? "text-accent" :
                    "text-muted-foreground/40"
                  }`}>
                    {active ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : completed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      icon
                    )}
                  </div>

                  {/* Step name */}
                  <span className={`text-sm flex-1 ${
                    completed ? "text-foreground" :
                    active ? "text-accent font-medium" :
                    "text-muted-foreground"
                  }`}>
                    {step.step}
                  </span>

                  {/* Detail + duration */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {step.detail && !active && (
                      <span className="hidden sm:inline truncate max-w-[200px]">
                        {step.detail}
                      </span>
                    )}
                    {completed && step.duration_ms > 0 && (
                      <span className="tabular-nums font-mono text-emerald-400/70">
                        {step.duration_ms >= 1000
                          ? `${(step.duration_ms / 1000).toFixed(1)}s`
                          : `${step.duration_ms}ms`}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Early source previews */}
      {sources.length > 0 && !done && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md"
        >
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Discovered Sources
          </p>
          <div className="space-y-1 px-3">
            {sources.slice(0, 5).map((src, i) => (
              <motion.div
                key={src.url}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Globe className="w-3 h-3 text-accent/50 shrink-0" />
                <span className="truncate">{src.title || new URL(src.url).hostname}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
