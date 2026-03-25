import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, Globe, FileText, Brain, Shield, GitMerge, Sparkles, Search, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { TraceEvent, SourcePreview } from "@/lib/api/stream";

// ── Icons ──

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
  "Rephrase Query": <RefreshCw className="w-4 h-4" />,
  "Select Best Result": <CheckCircle2 className="w-4 h-4" />,
  "Gap Analysis": <Brain className="w-4 h-4" />,
  "Deep Complete": <CheckCircle2 className="w-4 h-4" />,
  "Final Verification": <Shield className="w-4 h-4" />,
  "Neural Rerank": <Sparkles className="w-4 h-4" />,
};

// ── Deep mode grouping (unchanged — works well) ──

const GROUP_LABELS: Record<string, string> = {
  "step 1": "Initial Research",
  "step 2": "Follow-up Research",
  "step 3": "Deep Dive",
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "step 1": <Search className="w-4 h-4" />,
  "step 2": <Brain className="w-4 h-4" />,
  "step 3": <Sparkles className="w-4 h-4" />,
};

function getStepGroup(stepName: string): string | null {
  const match = stepName.match(/\((step \d+)\)$/);
  return match ? match[1] : null;
}

type GroupedStep = {
  type: "single";
  step: TraceEvent;
} | {
  type: "group";
  label: string;
  groupKey: string;
  icon: React.ReactNode;
  steps: TraceEvent[];
  totalDuration: number;
  completed: boolean;
  active: boolean;
};

function groupDeepSteps(steps: TraceEvent[], done: boolean): GroupedStep[] {
  const groups: GroupedStep[] = [];
  let currentGroupKey: string | null = null;
  let currentGroupSteps: TraceEvent[] = [];

  const flush = () => {
    if (currentGroupKey && currentGroupSteps.length > 0) {
      const totalDuration = currentGroupSteps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
      const allCompleted = currentGroupSteps.every((s) => s.duration_ms > 0);
      const lastSubStep = currentGroupSteps[currentGroupSteps.length - 1];
      const isActiveGroup = !done && !allCompleted && lastSubStep.duration_ms === 0;
      groups.push({
        type: "group",
        label: GROUP_LABELS[currentGroupKey] || `Research ${currentGroupKey}`,
        groupKey: currentGroupKey,
        icon: GROUP_ICONS[currentGroupKey] || <Search className="w-4 h-4" />,
        steps: currentGroupSteps,
        totalDuration,
        completed: allCompleted || done,
        active: isActiveGroup,
      });
      currentGroupSteps = [];
      currentGroupKey = null;
    }
  };

  for (const step of steps) {
    const group = getStepGroup(step.step);
    if (group) {
      if (group !== currentGroupKey) { flush(); currentGroupKey = group; }
      currentGroupSteps.push(step);
    } else {
      flush();
      groups.push({ type: "single", step });
    }
  }
  flush();
  return groups;
}

// ── Human-friendly step labels ──

const STEP_DISPLAY: Record<string, string> = {
  "Searching": "Scouring the web",
  "Search Web": "Scouring the web",
  "Query Plan": "Planning research strategy",
  "Fetching": "Reading sources",
  "Fetch Pages": "Reading sources",
  "Analyzing": "Extracting claims",
  "Extract Claims": "Extracting claims",
  "Verify Evidence": "Verifying against evidence",
  "Cross-Source Consensus": "Cross-referencing sources",
  "Build Evidence Graph": "Mapping the evidence",
  "Generate Answer": "Synthesizing findings",
  "Generating Answer": "Synthesizing findings",
  "Rephrase Query": "Refining the search",
  "Select Best Result": "Selecting best evidence",
  "Gap Analysis": "Looking for gaps",
  "Deep Complete": "Research complete",
  "Final Verification": "Final verification pass",
  "Neural Rerank": "Ranking by relevance",
};

function displayName(step: string): string {
  return STEP_DISPLAY[step] || step;
}

// ── Shared row components ──

const PROGRESS_STEPS = new Set(["Searching", "Fetching", "Analyzing", "Generating Answer"]);

interface Props {
  steps: TraceEvent[];
  sources: SourcePreview[];
  done: boolean;
  depth?: "fast" | "thorough" | "deep";
}

function StepRow({ step, active, completed }: { step: TraceEvent; active: boolean; completed: boolean }) {
  const baseStep = step.step.replace(/\s*\(.*\)$/, "");
  const icon = STEP_ICONS[step.step] || STEP_ICONS[baseStep] || <Circle className="w-4 h-4" />;

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg">
      <div className={`shrink-0 ${completed ? "text-emerald-400" : active ? "text-accent" : "text-muted-foreground/40"}`}>
        {active ? <Loader2 className="w-4 h-4 animate-spin" /> : completed ? <CheckCircle2 className="w-4 h-4" /> : icon}
      </div>
      <span className={`text-sm flex-1 ${completed ? "text-foreground" : active ? "text-accent font-medium" : "text-muted-foreground"}`}>
        {displayName(step.step)}
      </span>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {step.detail && !active && (
          <span className="hidden sm:inline truncate max-w-[200px]">{step.detail}</span>
        )}
        {completed && step.duration_ms > 0 && (
          <span className="tabular-nums font-mono text-emerald-400/70">
            {step.duration_ms >= 1000 ? `${(step.duration_ms / 1000).toFixed(1)}s` : `${step.duration_ms}ms`}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupRow({ group }: { group: Extract<GroupedStep, { type: "group" }> }) {
  const [expanded, setExpanded] = useState(false);
  const activeSubStep = group.active ? group.steps.find((s) => s.duration_ms === 0) : null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 py-1.5 px-3 rounded-lg w-full text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`shrink-0 ${group.completed ? "text-emerald-400" : group.active ? "text-accent" : "text-muted-foreground/40"}`}>
          {group.active ? <Loader2 className="w-4 h-4 animate-spin" /> : group.completed ? <CheckCircle2 className="w-4 h-4" /> : group.icon}
        </div>
        <span className={`text-sm flex-1 ${group.completed ? "text-foreground" : group.active ? "text-accent font-medium" : "text-muted-foreground"}`}>
          {group.label}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {group.active && activeSubStep && (
            <span className="text-accent/70 truncate max-w-[150px]">{activeSubStep.step.replace(/\s*\(.*\)$/, "")}...</span>
          )}
          {group.completed && group.totalDuration > 0 && (
            <span className="tabular-nums font-mono text-emerald-400/70">
              {group.totalDuration >= 1000 ? `${(group.totalDuration / 1000).toFixed(1)}s` : `${group.totalDuration}ms`}
            </span>
          )}
          <span className="text-muted-foreground/50">{group.steps.length} steps</span>
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground/50" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-4 border-l border-muted-foreground/10 ml-5"
          >
            {group.steps.map((subStep, j) => {
              const subActive = group.active && subStep === group.steps[group.steps.length - 1] && subStep.duration_ms === 0;
              const subCompleted = subStep.duration_ms > 0 || group.completed;
              return (
                <motion.div key={`${subStep.step}-${j}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs">
                  <StepRow step={subStep} active={subActive} completed={subCompleted} />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pill-based pipeline (same style as Playground's PipelineSteps) ──

const PIPELINE_STEPS = {
  fast: ["Search Web", "Fetch Pages", "Extract Claims", "Verify Evidence", "Generate Answer"],
  thorough: ["Search Web", "Fetch Pages", "Extract & Verify", "Rephrase Query", "Second Pass", "Select Best"],
};

function PipelinePills({ depth, done }: { depth: "fast" | "thorough"; done: boolean }) {
  const pills = PIPELINE_STEPS[depth];
  const [activeStep, setActiveStep] = useState(0);

  // Pure timer-based cycling — same as Playground
  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pills.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [done, pills.length]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
      {pills.map((step, i) => (
        <motion.span
          key={step}
          animate={{
            opacity: i <= activeStep ? 1 : 0.3,
            scale: i === activeStep ? 1.05 : 1,
          }}
          transition={{ duration: 0.3 }}
          className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
            i < activeStep
              ? "text-emerald-400 border-emerald-500/30"
              : i === activeStep
              ? "text-accent border-accent/40"
              : "text-muted-foreground border-border"
          }`}
        >
          {i < activeStep ? "✓" : i === activeStep ? "●" : "○"} {step}
        </motion.span>
      ))}
    </div>
  );
}

// ── Main component ──

export function StreamingPipeline({ steps, sources, done, depth = "fast" }: Props) {
  // Filter out progress indicator duplicates
  const displaySteps = steps.filter((step) => {
    if (PROGRESS_STEPS.has(step.step) && step.duration_ms === 0) {
      const realStepMap: Record<string, string> = {
        "Searching": "Search Web",
        "Fetching": "Fetch Pages",
        "Analyzing": "Extract Claims",
        "Generating Answer": "Generate Answer",
      };
      const realName = realStepMap[step.step];
      return !steps.some((s) => s.step === realName || s.step.startsWith(realName + " ("));
    }
    return true;
  });

  const lastStep = displaySteps[displaySteps.length - 1];

  // Current activity label
  const currentLabel = lastStep
    ? (() => {
        const suffix = getStepGroup(lastStep.step);
        if (suffix) {
          const baseName = lastStep.step.replace(/\s*\(.*\)$/, "");
          return `${GROUP_LABELS[suffix] || suffix}: ${displayName(baseName)}`;
        }
        return displayName(lastStep.step);
      })()
    : null;

  const isDeep = depth === "deep";

  // For deep mode, group the display steps
  const deepGroups = isDeep ? groupDeepSteps(displaySteps, done) : [];

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
          {currentLabel ? (
            <motion.p
              key={currentLabel}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-accent"
            >
              {currentLabel}...
            </motion.p>
          ) : (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium text-accent"
            >
              {depth === "deep" ? "Deep reasoning" : depth === "thorough" ? "Thorough analysis" : "Researching"}…
            </motion.span>
          )}
        </motion.div>
      )}

      {/* Depth badge */}
      {!done && depth !== "fast" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
            depth === "deep"
              ? "text-purple-400 border-purple-500/30 bg-purple-500/5"
              : "text-accent border-accent/30 bg-accent/5"
          }`}>
            {depth === "deep" ? <Brain className="w-3 h-3 inline mr-1" /> : <RefreshCw className="w-3 h-3 inline mr-1" />}
            {depth === "deep" ? "Deep Mode" : "Thorough Mode"}
          </span>
        </motion.div>
      )}

      {/* Step timeline — different approach per mode */}
      {isDeep ? (
        // Deep mode: grouped expandable view
        <div className="w-full max-w-xs sm:max-w-md space-y-1">
          <AnimatePresence mode="popLayout">
            {deepGroups.map((item, i) => (
              <motion.div
                key={item.type === "single" ? `s-${item.step.step}-${i}` : `g-${item.groupKey}-${i}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                {item.type === "single" ? (
                  <StepRow
                    step={item.step}
                    active={item.step === lastStep && !done && item.step.duration_ms === 0}
                    completed={item.step.duration_ms > 0 || done}
                  />
                ) : (
                  <GroupRow group={item} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        // Fast/Thorough: pill-based pipeline (same as Playground)
        <PipelinePills depth={depth as "fast" | "thorough"} done={done} />
      )}

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
