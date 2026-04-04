import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";
import {
  ArrowLeft, ArrowRight, CheckCircle2, XCircle, Minus,
  Shield, Brain, Code2, Layers,
  Terminal, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// --- Competitor data ---

interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  pricing: string;
  strengths: string[];
  limitations: string[];
  useCases: string[];
}

const COMPETITORS: Competitor[] = [
  {
    slug: "tavily",
    name: "Tavily",
    tagline: "Search API for AI agents",
    description:
      "Tavily provides a search API designed for LLM applications with AI-synthesized answers, relevance scoring, and strong framework integrations. Popular in LangChain and agent ecosystems.",
    pricing: "Free tier (1K searches/mo), paid plans from $50/mo",
    strengths: [
      "Fast response times with AI answer synthesis",
      "Strong LangChain, CrewAI, and MCP integrations",
      "Relevance scoring on search results",
      "Open-source SDKs and MCP server (Apache 2.0)",
    ],
    limitations: [
      "Relevance scores measure query match, not factual accuracy",
      "No native claim-level verification pipeline found in public product docs",
      "No native contradiction detection found in public product docs",
    ],
    useCases: ["Search augmentation for agents", "RAG pipelines", "LangChain tool use"],
  },
  {
    slug: "perplexity",
    name: "Perplexity AI",
    tagline: "Answer engine with citations",
    description:
      "Perplexity is an answer engine with cited responses. Has official MCP server, Python SDK, and LangChain integration. API (Sonar) offers multiple model options.",
    pricing: "Free tier, Pro $20/mo, API usage-based",
    strengths: [
      "Polished answers with inline citations",
      "Official MCP server, Python SDK, LangChain",
      "Large consumer user base and brand recognition",
      "Multiple model options (Sonar, Deep Research)",
    ],
    limitations: [
      "No native claim-level verification pipeline found in public product docs",
      "No evidence-based factual confidence scoring found in public API docs",
      "Core engine is closed-source (some SDKs are open-source)",
    ],
    useCases: ["Consumer search replacement", "Quick Q&A with citations", "Research summaries"],
  },
  {
    slug: "exa",
    name: "Exa",
    tagline: "Neural search API",
    description:
      "Exa (formerly Metaphor) offers a neural search engine with semantic understanding. Has MCP server, Python SDK, LangChain integration, and an /answer endpoint. Publishes hallucination detection guides using Exa + external tooling.",
    pricing: "Free tier (1K searches/mo), paid plans from $100/mo",
    strengths: [
      "Semantic neural search (not keyword-based)",
      "AI answer endpoint with citations",
      "Official MCP server and LangChain package",
      "Open-source hallucination detection tool (uses Exa search + external LLM)",
    ],
    limitations: [
      "Hallucination detection is an open-source tool built on Exa + external LLM, not a native API feature",
      "No native confidence scoring for factual accuracy",
      "No native contradiction detection or source consensus",
    ],
    useCases: ["Semantic document retrieval", "Similar content discovery", "Research exploration"],
  },
  {
    slug: "you",
    name: "You.com",
    tagline: "AI search platform",
    description:
      "You.com provides search APIs with AI-generated answers via Research API and Express Agent. Has official MCP server and LangChain integration.",
    pricing: "Free tier, paid plans from $100/mo",
    strengths: [
      "Research API with controllable depth",
      "Official MCP server and LangChain integration",
      "AI-generated answers with citations",
      "Privacy-focused option",
    ],
    limitations: [
      "No native claim verification pipeline found in public product docs",
      "No evidence-based factual confidence scoring found in public API docs",
      "Core engine is closed-source (some open-source tools)",
    ],
    useCases: ["General web search", "Research with AI synthesis", "RAG applications"],
  },
  {
    slug: "brave",
    name: "Brave Search API",
    tagline: "Independent search index",
    description:
      "Brave Search offers an independent search index (not sourced from Google/Bing). Their API provides web, news, and image search with privacy-first design. Has an official MCP server and AI Answers grounded in verifiable sources.",
    pricing: "Free tier (2K queries/mo), paid from $5/1K queries",
    strengths: [
      "Independent search index (not Google/Bing)",
      "AI Answers grounded in verifiable sources",
      "LLM Context with relevance-scored content",
      "Official MCP server and LangChain integration",
    ],
    limitations: [
      "No native claim-level verification or evidence analysis documented",
      "No structured confidence scoring exposed in API",
      "Core search index is closed-source",
    ],
    useCases: ["Privacy-conscious search", "Independent web index access", "Cost-effective bulk search"],
  },
];

type FeatureSupport = "full" | "partial" | "none";

interface FeatureRow {
  feature: string;
  tooltip?: string;
  browseai: FeatureSupport;
  tavily: FeatureSupport;
  perplexity: FeatureSupport;
  exa: FeatureSupport;
  you: FeatureSupport;
  brave: FeatureSupport;
}

// Feature matrix — honest assessment.
// "full" = native built-in feature documented in product.
// "partial" = available via workarounds, guides, or limited form.
// "none" = not documented as a native built-in feature.
const FEATURE_MATRIX: FeatureRow[] = [
  // Shared capabilities — most providers offer these
  { feature: "Web search", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "full" },
  { feature: "AI-synthesized answers", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "full" },
  { feature: "Citations / sources", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "full" },
  { feature: "MCP server", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "full" },
  { feature: "Python SDK", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "partial" },
  { feature: "LangChain integration", browseai: "full", tavily: "full", perplexity: "full", exa: "full", you: "full", brave: "full" },
  { feature: "CrewAI integration", browseai: "full", tavily: "full", perplexity: "partial", exa: "partial", you: "none", brave: "none" },
  // BrowseAI Dev differentiation — native built-in verification features
  { feature: "Native claim verification", tooltip: "Built-in claim-level verification pipeline", browseai: "full", tavily: "none", perplexity: "none", exa: "partial", you: "none", brave: "none" },
  { feature: "Evidence-based confidence scores", tooltip: "Evidence-based algorithm, not LLM self-assessment", browseai: "full", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
  { feature: "Contradiction detection", tooltip: "Cross-source contradiction scanning", browseai: "full", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
  { feature: "Cross-source consensus", tooltip: "Claims verified across multiple independent sources", browseai: "full", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
  { feature: "Domain authority scoring", tooltip: "Domain authority scoring with 10K+ domains", browseai: "full", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
  // Infrastructure
  { feature: "Open source (full pipeline)", browseai: "full", tavily: "partial", perplexity: "partial", exa: "partial", you: "partial", brave: "partial" },
  { feature: "Self-hostable", browseai: "partial", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
  { feature: "BYOK (bring your own keys)", browseai: "full", tavily: "none", perplexity: "none", exa: "none", you: "none", brave: "none" },
];

const COLUMN_NAMES: Record<string, string> = {
  browseai: "BrowseAI Dev",
  tavily: "Tavily",
  perplexity: "Perplexity",
  exa: "Exa",
  you: "You.com",
  brave: "Brave",
};

function SupportIcon({ support }: { support: FeatureSupport }) {
  if (support === "full")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (support === "partial")
    return <Minus className="w-4 h-4 text-yellow-400" />;
  return <XCircle className="w-4 h-4 text-zinc-600" />;
}

// --- Hub Page ---

const Alternatives = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Alternatives — Compare AI Search APIs"
        description="Compare BrowseAI Dev vs Tavily, Perplexity, Exa, You.com, and Brave Search. Feature matrix, pricing, and honest comparison of AI search APIs for agents."
        canonical="/alternatives"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "BrowseAI Dev Alternatives — Compare AI Search APIs",
          description:
            "Compare BrowseAI Dev vs Tavily, Perplexity, Exa, You.com, and Brave Search API for AI agent research.",
          url: "https://browseai.dev/alternatives",
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-5 bg-background/80 backdrop-blur-sm border-b border-border/50"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
              <span className="font-semibold text-sm">BrowseAI Dev</span>
            </div>
          </div>
          <div className="flex items-center gap-2" />
        </motion.nav>

        <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative text-center space-y-4 py-8 grid-bg grid-bg-fade rounded-2xl"
          >
            <div className="hero-glow" />
            <Badge variant="outline" className="text-xs border-accent/30 text-accent">
              Agent-First Research Infrastructure
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-shimmer">
              BrowseAI Dev vs. the alternatives
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Tavily, Exa, Brave, Perplexity, and You.com all help agents search
              or synthesize web information. BrowseAI Dev's distinction is native
              claim verification and evidence-based confidence, rather than search
              or citations alone.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto font-mono terminal-card px-4 py-2 rounded-lg bg-card/50 border border-border/50 inline-block">
              Agent → BrowseAI Dev → Internet → Evidence-backed answers + confidence scores
            </p>
          </motion.section>

          {/* Transparency note */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 glow-pulse">
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 text-accent bg-accent/10 mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Full transparency:</strong> BrowseAI Dev is a verification and intelligence layer,
                  not a search engine replacement. We use providers like Tavily and Brave for web search,
                  then add claim extraction, cross-source verification, contradiction detection, domain authority scoring,
                  and confidence calibration on top. These providers are excellent at search. BrowseAI Dev adds the
                  verification layer that turns raw search results into agent-ready, evidence-backed outputs.
                </div>
              </div>
            </div>
          </motion.section>

          {/* Feature Matrix */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-shimmer inline-block">Feature comparison</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Based on publicly documented product features as of March 2026. "Not documented as native" means we did not find
                the capability described as a built-in product feature in official public documentation.
                Competitors may support similar outcomes through external tooling, prompt workflows, or custom integrations.
                We are actively verifying these claims and will correct any inaccuracies found.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/50 glow-pulse">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[200px]">
                      Feature
                    </th>
                    {Object.entries(COLUMN_NAMES).map(([key, name]) => (
                      <th
                        key={key}
                        className={`text-center px-3 py-3 font-medium min-w-[100px] ${
                          key === "browseai"
                            ? "text-accent bg-accent/5"
                            : "text-muted-foreground"
                        }`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-border/50 ${
                        i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-foreground">
                        <span>{row.feature}</span>
                        {row.tooltip && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{row.tooltip}</span>
                        )}
                      </td>
                      {(
                        Object.keys(COLUMN_NAMES) as Array<
                          keyof typeof COLUMN_NAMES
                        >
                      ).map((key) => (
                        <td
                          key={key}
                          className={`text-center px-3 py-2.5 ${
                            key === "browseai" ? "bg-accent/5" : ""
                          }`}
                        >
                          <div className="flex justify-center">
                            <SupportIcon
                              support={row[key as keyof FeatureRow] as FeatureSupport}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Native built-in
              </span>
              <span className="flex items-center gap-1.5">
                <Minus className="w-3.5 h-3.5 text-yellow-400" /> Partial / workflow-dependent
              </span>
              <span className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-zinc-600" /> Not documented as native
              </span>
            </div>
          </motion.section>

          {/* Key differentiators */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-semibold text-shimmer inline-block">
              What BrowseAI Dev adds on top
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              BrowseAI Dev is differentiated in offering native claim-level verification,
              contradiction detection, and cross-source consensus in a single agent-focused
              workflow. We did not find these documented together as built-in features
              in competing products.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  title: "Evidence-based confidence",
                  desc: "Multi-factor confidence score derived from verification data (source count, domain authority, consensus, claim grounding, source recency) — not LLM self-assessment. Your agent knows how much to trust each answer.",
                },
                {
                  icon: Brain,
                  title: "Native verification pipeline",
                  desc: "Claims decomposed and individually verified against sources, cross-checked for consensus, and scanned for contradictions. All built into the API — no external tooling needed.",
                },
                {
                  icon: Code2,
                  title: "Open infrastructure",
                  desc: "Open-core model: SDKs, MCP server, and integrations are Apache 2.0. Verification engine runs as managed service with free API keys.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-5 rounded-lg border border-border bg-card space-y-2 card-lift hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
                >
                  <item.icon className="w-5 h-5 text-accent bg-accent/10 rounded p-0.5" />
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Individual competitor cards */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-semibold text-shimmer inline-block">Detailed comparisons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPETITORS.map((c) => (
                <div
                  key={c.slug}
                  className="group p-5 rounded-lg border border-border bg-card card-lift hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 cursor-pointer"
                  onClick={() => navigate(`/alternatives/${c.slug}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-lg">{c.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {c.tagline}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors mt-1" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {c.pricing}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.limitations.slice(0, 2).map((w) => (
                      <Badge
                        key={w}
                        variant="outline"
                        className="text-xs text-zinc-400"
                      >
                        {w.length > 50 ? w.slice(0, 47) + "..." : w}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-[11px] text-muted-foreground/50 text-center max-w-2xl mx-auto leading-relaxed"
          >
            This comparison is based on publicly available documentation as of March 2026 and may contain inaccuracies.
            We are actively working to verify all claims on this page. Features marked as "not documented" may exist
            but were not found in official public documentation at the time of writing. Features and pricing
            may have changed. All trademarks belong to their respective owners. If you represent a listed product and
            believe any information is inaccurate, please contact us at{" "}
            <a href="mailto:shreyassaw@gmail.com" className="underline hover:text-muted-foreground/70">shreyassaw@gmail.com</a>{" "}
            and we will update promptly.
          </motion.div>

          {/* CTA */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative text-center py-12 space-y-4 rounded-2xl grid-bg grid-bg-fade"
          >
            <div className="hero-glow" />
            <h2 className="text-2xl font-bold text-shimmer inline-block">Try it yourself</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Run your own queries through BrowseAI Dev and see evidence-backed answers
              with claim verification, confidence scores, and verified sources.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button className="glow-pulse" onClick={() => navigate("/playground")}>
                <Terminal className="w-4 h-4 mr-1.5" />
                Playground
              </Button>
              <Button variant="outline" className="hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5" onClick={() => navigate("/docs")}>
                <BookOpen className="w-4 h-4 mr-1.5" />
                API Docs
              </Button>
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default Alternatives;
