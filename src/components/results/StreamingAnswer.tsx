import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface StreamingAnswerProps {
  /** Accumulated answer text so far */
  text: string;
  /** Whether the stream is still producing tokens */
  streaming: boolean;
  /** Full answer confidence (only shown when done) */
  confidence?: number;
}

/**
 * Renders answer text as it streams in, with a typing cursor.
 * When done, removes the cursor and shows the final text.
 */
export function StreamingAnswer({ text, streaming, confidence }: StreamingAnswerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as tokens arrive
  useEffect(() => {
    if (streaming && containerRef.current) {
      const el = containerRef.current;
      // Only auto-scroll if user hasn't scrolled up
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [text, streaming]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Confidence pill (only when done) */}
      {!streaming && confidence != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3"
        >
          <span
            className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${
              confidence >= 0.75
                ? "bg-green-400/10 border-green-400/30 text-green-400"
                : confidence >= 0.55
                ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                : "bg-red-400/10 border-red-400/30 text-red-400"
            }`}
          >
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        </motion.div>
      )}

      {streaming && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-muted-foreground">Synthesizing from verified sources…</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="p-4 rounded-xl bg-card border border-border text-sm leading-relaxed max-h-[500px] overflow-y-auto"
        style={streaming ? { borderColor: "rgba(52, 211, 153, 0.3)" } : undefined}
      >
        <span className="whitespace-pre-wrap">{text}</span>
        {streaming && (
          <span className="inline-block w-[2px] h-[1.1em] bg-accent ml-0.5 align-text-bottom animate-pulse" />
        )}
      </div>
    </motion.div>
  );
}
