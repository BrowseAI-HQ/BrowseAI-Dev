import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Brain, RefreshCw } from "lucide-react";

const PIPELINE_STEPS: Record<string, string[]> = {
  fast: ["Recall Knowledge", "Search Web", "Fetch Pages", "Extract Claims", "Verify Evidence", "Generate Answer"],
  thorough: ["Recall Knowledge", "Search Web", "Fetch Pages", "Extract & Verify", "Rephrase Query", "Second Pass", "Select Best"],
  deep: ["Recall Knowledge", "Initial Research", "Gap Analysis", "Follow-up Research", "Final Verification", "Generate Answer"],
};

/**
 * Pill-based pipeline animation for session ask.
 * Matches Playground and Results page animation style.
 * Cycles through pills on a timer since sessions use non-streaming API.
 */
export function SessionPipelineProgress({ depth = "fast" }: { depth?: "fast" | "thorough" | "deep" }) {
  const pills = PIPELINE_STEPS[depth] || PIPELINE_STEPS.fast;
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pills.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [pills.length]);

  return (
    <div className="flex flex-col items-center py-8 space-y-6">
      {/* Spinner + label */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <div className="absolute inset-0 w-8 h-8 rounded-full bg-accent/10 animate-ping" />
        </div>
        <motion.p
          key={pills[activeStep]}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium text-accent"
        >
          {pills[activeStep]}...
        </motion.p>
      </motion.div>

      {/* Depth badge */}
      {depth !== "fast" && (
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

      {/* Pills */}
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
    </div>
  );
}
