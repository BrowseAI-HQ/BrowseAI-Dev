import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle, Globe, FileText, Brain, Shield, GitMerge, Sparkles, Search, ChevronDown, ChevronRight, Zap, RefreshCw } from "lucide-react";
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
  "Rephrase Query": <Brain className="w-4 h-4" />,
  "Select Best Result": <CheckCircle2 className="w-4 h-4" />,
  "Gap Analysis": <Brain className="w-4 h-4" />,
  "Deep Complete": <CheckCircle2 className="w-4 h-4" />,
  "Final Verification": <Shield className="w-4 h-4" />,
  "Neural Rerank": <Sparkles className="w-4 h-4" />,
  "Generating Answer": <Sparkles className="w-4 h-4" />,
};

// ── Group labels & icons per mode ──

const GROUP_LABELS: Record<string, string> = {
  // Deep mode
  "step 1": "Initial Research",
  "step 2": "Follow-up Research",
  "step 3": "Deep Dive",
  // Thorough mode
  "pass 1": "First Pass",
  "pass 2": "Second Pass",
  // Fast mode
  "search": "Search & Discover",
  "analyze": "Analyze & Verify",
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "step 1": <Search className="w-4 h-4" />,
  "step 2": <Brain className="w-4 h-4" />,
  "step 3": <Sparkles className="w-4 h-4" />,
  "pass 1": <Search className="w-4 h-4" />,
  "pass 2": <RefreshCw className="w-4 h-4" />,
  "search": <Globe className="w-4 h-4" />,
  "analyze": <Shield className="w-4 h-4" />,
};

// Steps that are "in-progress" indicators (duration_ms = 0, emitted before the real step)
const PROGRESS_STEPS = new Set(["Searching", "Fetching", "Analyzing", "Generating Answer"]);

// Fast mode: steps that belong to the "Search & Discover" phase
const FAST_SEARCH_STEPS = new Set(["Search Web", "Query Plan", "Fetch Pages", "Neural Rerank"]);

/** Extract group key from a step name suffix. */
function getStepGroup(stepName: string): string | null {
  const match = stepName.match(/\((step \d+|pass \d+)\)$/);
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

function buildGroup(key: string, steps: TraceEvent[], done: boolean): GroupedStep {
  const totalDuration = steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
  const allCompleted = steps.every((s) => s.duration_ms > 0);
  const lastSubStep = steps[steps.length - 1];
  const isActiveGroup = !done && !allCompleted && lastSubStep.duration_ms === 0;
  return {
    type: "group",
    label: GROUP_LABELS[key] || key,
    groupKey: key,
    icon: GROUP_ICONS[key] || <Search className="w-4 h-4" />,
    steps,
    totalDuration,
    completed: allCompleted || done,
    active: isActiveGroup,
  };
}

/** Group steps for deep/thorough modes — groups by "(step N)" or "(pass N)" suffix. */
function groupBySuffix(steps: TraceEvent[], done: boolean): GroupedStep[] {
  const groups: GroupedStep[] = [];
  let currentGroupKey: string | null = null;
  let currentGroupSteps: TraceEvent[] = [];

  const flush = () => {
    if (currentGroupKey && currentGroupSteps.length > 0) {
      groups.push(buildGroup(currentGroupKey, currentGroupSteps, done));
      currentGroupSteps = [];
      currentGroupKey = null;
    }
  };

  for (const step of steps) {
    const group = getStepGroup(step.step);
    if (group) {
      if (group !== currentGroupKey) {
        flush();
        currentGroupKey = group;
      }
      currentGroupSteps.push(step);
    } else {
      flush();
      groups.push({ type: "single", step });
    }
  }
  flush();
  return groups;
}

/** Group steps for fast mode — split into "Search & Discover" vs "Analyze & Verify". */
function groupFastSteps(steps: TraceEvent[], done: boolean): GroupedStep[] {
  const searchSteps: TraceEvent[] = [];
  const analyzeSteps: TraceEvent[] = [];

  for (const step of steps) {
    if (FAST_SEARCH_STEPS.has(step.step)) {
      searchSteps.push(step);
    } else {
      analyzeSteps.push(step);
    }
  }

  const groups: GroupedStep[] = [];
  if (searchSteps.length > 0) groups.push(buildGroup("search", searchSteps, done));
  if (analyzeSteps.length > 0) groups.push(buildGroup("analyze", analyzeSteps, done));
  return groups;
}

/** Group first-pass (no suffix) steps for thorough mode into "pass 1". */
function groupThoroughSteps(steps: TraceEvent[], done: boolean): GroupedStep[] {
  const groups: GroupedStep[] = [];
  let pass1Steps: TraceEvent[] = [];
  let inPass1 = true;

  for (const step of steps) {
    const suffix = getStepGroup(step.step);

    if (suffix === "pass 2") {
      // Flush pass 1 before starting pass 2 group
      if (inPass1 && pass1Steps.length > 0) {
        groups.push(buildGroup("pass 1", pass1Steps, done));
        pass1Steps = [];
        inPass1 = false;
      }
    }

    if (inPass1) {
      // Standalone steps between passes (Rephrase Query)
      if (step.step === "Rephrase Query" || step.step === "Select Best Result") {
        if (pass1Steps.length > 0) {
          groups.push(buildGroup("pass 1", pass1Steps, done));
          pass1Steps = [];
        }
        inPass1 = false;
        groups.push({ type: "single", step });
      } else {
        pass1Steps.push(step);
      }
    } else {
      // After pass 1 — use suffix-based grouping for pass 2
      if (suffix === "pass 2") {
        // Check if we already have a pass 2 group started
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.type === "group" && lastGroup.groupKey === "pass 2") {
          lastGroup.steps.push(step);
          // Recalculate group state
          lastGroup.totalDuration = lastGroup.steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
          const allCompleted = lastGroup.steps.every((s) => s.duration_ms > 0);
          const lastSub = lastGroup.steps[lastGroup.steps.length - 1];
          lastGroup.completed = allCompleted || done;
          lastGroup.active = !done && !allCompleted && lastSub.duration_ms === 0;
        } else {
          groups.push(buildGroup("pass 2", [step], done));
        }
      } else if (step.step === "Rephrase Query" || step.step === "Select Best Result") {
        groups.push({ type: "single", step });
      } else {
        // Standalone step between passes (e.g., "Analyzing" progress indicator)
        // Try to add to the pass 2 group if it exists
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.type === "group" && lastGroup.groupKey === "pass 2") {
          lastGroup.steps.push(step);
          lastGroup.totalDuration = lastGroup.steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
          const allCompleted = lastGroup.steps.every((s) => s.duration_ms > 0);
          const lastSub = lastGroup.steps[lastGroup.steps.length - 1];
          lastGroup.completed = allCompleted || done;
          lastGroup.active = !done && !allCompleted && lastSub.duration_ms === 0;
        } else {
          groups.push({ type: "single", step });
        }
      }
    }
  }

  // Flush remaining pass 1 steps (fast mode that didn't trigger rephrase)
  if (pass1Steps.length > 0) {
    groups.push(buildGroup("pass 1", pass1Steps, done));
  }

  return groups;
}

/** Route to the right grouping strategy. */
function groupSteps(steps: TraceEvent[], done: boolean, depth: "fast" | "thorough" | "deep"): GroupedStep[] {
  if (depth === "deep") return groupBySuffix(steps, done);
  if (depth === "thorough") return groupThoroughSteps(steps, done);
  return groupFastSteps(steps, done);
}

// ── Pipeline overview animation ──

const PIPELINE_OVERVIEW = {
  fast: ["Search Web", "Fetch Pages", "Extract Claims", "Verify Evidence", "Generate Answer"],
  thorough: ["Search Web", "Fetch Pages", "Extract & Verify", "Rephrase Query", "Second Pass", "Select Best"],
  deep: ["Initial Research", "Gap Analysis", "Follow-up Search", "Merge Knowledge", "Final Verification"],
};

function PipelineOverview({ depth }: { depth: "fast" | "thorough" | "deep" }) {
  const steps = PIPELINE_OVERVIEW[depth];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
      {steps.map((step, i) => (
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

// ── Shared components ──

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
      <span className={`text-sm flex-1 ${
        completed ? "text-foreground" :
        active ? "text-accent font-medium" :
        "text-muted-foreground"
      }`}>
        {step.step}
      </span>
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
  );
}

function GroupRow({ group }: { group: Extract<GroupedStep, { type: "group" }> }) {
  const [expanded, setExpanded] = useState(false);
  const activeSubStep = group.active
    ? group.steps.find((s) => s.duration_ms === 0)
    : null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 py-1.5 px-3 rounded-lg w-full text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`shrink-0 ${
          group.completed ? "text-emerald-400" :
          group.active ? "text-accent" :
          "text-muted-foreground/40"
        }`}>
          {group.active ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : group.completed ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            group.icon
          )}
        </div>
        <span className={`text-sm flex-1 ${
          group.completed ? "text-foreground" :
          group.active ? "text-accent font-medium" :
          "text-muted-foreground"
        }`}>
          {group.label}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {group.active && activeSubStep && (
            <span className="text-accent/70 truncate max-w-[150px]">
              {activeSubStep.step.replace(/\s*\(.*\)$/, "")}...
            </span>
          )}
          {group.completed && group.totalDuration > 0 && (
            <span className="tabular-nums font-mono text-emerald-400/70">
              {group.totalDuration >= 1000
                ? `${(group.totalDuration / 1000).toFixed(1)}s`
                : `${group.totalDuration}ms`}
            </span>
          )}
          <span className="text-muted-foreground/50">
            {group.steps.length} steps
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
          )}
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
                <motion.div
                  key={`${subStep.step}-${j}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs"
                >
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

// ── Main component ──

export function StreamingPipeline({ steps, sources, done, depth = "fast" }: Props) {
  // Filter out in-progress indicator steps once the real step arrives
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
  const grouped = groupSteps(displaySteps, done, depth);

  // Compute a friendly label for the current activity
  const currentLabel = lastStep
    ? (() => {
        const suffix = getStepGroup(lastStep.step);
        if (suffix) {
          const baseName = lastStep.step.replace(/\s*\(.*\)$/, "");
          const groupLabel = GROUP_LABELS[suffix];
          return groupLabel ? `${groupLabel}: ${baseName}` : baseName;
        }
        return lastStep.step;
      })()
    : null;

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
          {/* Pipeline overview animation — shown before real trace steps arrive */}
          {displaySteps.length === 0 && (
            <PipelineOverview depth={depth} />
          )}
        </motion.div>
      )}

      {/* Depth badge */}
      {!done && displaySteps.length > 0 && depth !== "fast" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5"
        >
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

      {/* Grouped step timeline */}
      <div className="w-full max-w-md space-y-1">
        <AnimatePresence mode="popLayout">
          {grouped.map((item, i) => (
            <motion.div
              key={item.type === "single" ? `single-${item.step.step}-${i}` : `group-${item.groupKey}-${i}`}
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
