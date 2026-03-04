import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

type TraceStep = { step: string; duration_ms: number; detail?: string };

export function TracePipeline({ trace }: { trace: TraceStep[] }) {
  const total = trace.reduce((s, t) => s + t.duration_ms, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trace Pipeline</h2>
        <span className="text-xs font-mono text-muted-foreground">{(total / 1000).toFixed(1)}s total</span>
      </div>
      <div className="space-y-2">
        {trace.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border"
          >
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <span className="text-sm font-medium flex-1">{step.step}</span>
            {step.detail && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{step.detail}</span>
            )}
            <span className="text-xs font-mono text-accent tabular-nums">{step.duration_ms}ms</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
