import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

function getSteps(query: string): string[] {
  const q = query.toLowerCase();
  // Health/medical
  if (/health|medical|symptom|drug|treatment|vitamin|diet|fasting|exercise/.test(q))
    return ["Consulting medical sources…", "Cross-referencing clinical data…", "Verifying health claims…", "Weighing contradictions…", "Synthesizing evidence…"];
  // Finance/money
  if (/stock|invest|price|revenue|market|crypto|finance|economy|tax/.test(q))
    return ["Scanning financial sources…", "Verifying reported figures…", "Cross-checking market data…", "Assessing source reliability…", "Synthesizing findings…"];
  // Science/research
  if (/research|study|paper|quantum|physics|biology|chemistry|climate|space/.test(q))
    return ["Searching academic literature…", "Extracting research findings…", "Cross-referencing publications…", "Identifying consensus…", "Synthesizing evidence…"];
  // Legal
  if (/law|legal|regulation|court|rights|contract|patent|gdpr/.test(q))
    return ["Searching legal databases…", "Extracting relevant statutes…", "Cross-referencing interpretations…", "Verifying precedents…", "Synthesizing analysis…"];
  // Tech/programming
  if (/api|code|programming|software|bug|framework|react|python|javascript/.test(q))
    return ["Searching documentation…", "Extracting technical details…", "Verifying compatibility…", "Cross-referencing sources…", "Synthesizing answer…"];
  // Product/shopping
  if (/best|review|buy|product|compare|recommend|price|cheap|expensive/.test(q))
    return ["Scanning product sources…", "Extracting real reviews…", "Filtering sponsored content…", "Comparing across sources…", "Building recommendation…"];
  // News/current events
  if (/news|election|war|announce|launch|update|today|2026|latest/.test(q))
    return ["Scanning live sources…", "Cross-referencing reports…", "Checking for retractions…", "Verifying timeline…", "Synthesizing coverage…"];
  // Default
  return ["Searching across the web…", "Reading and extracting claims…", "Verifying against sources…", "Scoring confidence…", "Synthesizing answer…"];
}

export function LoadingPipeline({ query = "" }: { query?: string }) {
  const steps = getSteps(query);
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
      <div className="space-y-3 w-full max-w-sm">
        {steps.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ delay: i * 0.5, duration: 2, repeat: Infinity }}
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
            {step}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
