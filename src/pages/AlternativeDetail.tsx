import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";
import {
  ArrowLeft, CheckCircle2, XCircle, Shield,
  Terminal, BookOpen, Layers, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// --- Competitor data ---

interface CompetitorDetail {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  pricing: string;
  strengths: string[];
  limitations: string[];
  useCases: string[];
  browseaiDifferentiators: string[];
  transparencyNote?: string;
  seoTitle: string;
  seoDescription: string;
}

const COMPETITOR_DETAILS: Record<string, CompetitorDetail> = {
  tavily: {
    slug: "tavily",
    name: "Tavily",
    tagline: "Search API for AI agents",
    description:
      "Tavily is a popular search API designed for LLM applications. It returns cleaned, relevant search results with AI-synthesized answers and has strong framework integrations including LangChain, CrewAI, and MCP.",
    pricing: "Free tier (1K searches/mo), paid plans from $50/mo",
    strengths: [
      "Fast response times (sub-second for fast/ultra-fast modes)",
      "AI-synthesized answers via include_answer parameter",
      "Full MCP server (tavily-mcp on npm, including remote MCP with OAuth)",
      "First-class LangChain integration; CrewAI compatible via LangChain tools",
      "Relevance scoring on each search result",
      "Open-source SDKs and MCP server (Apache 2.0)",
      "Good developer documentation and affordable pricing",
    ],
    limitations: [
      "Relevance scores measure query-match, not whether information is factually accurate",
      "No native claim-level verification pipeline documented",
      "No native contradiction detection across sources documented",
      "No cross-source consensus or domain authority scoring documented",
      "Core search engine is closed-source (SDKs are open)",
    ],
    useCases: [
      "Search augmentation for AI agents",
      "RAG pipelines needing web context",
      "LangChain/CrewAI tool use",
    ],
    browseaiDifferentiators: [
      "BrowseAI Dev decomposes claims and verifies each individually — adding a verification layer on top of search",
      "Evidence-based confidence scores derived from verification data, not query-match relevance",
      "Contradiction detection surfaces conflicting information across sources",
      "Cross-source consensus ensures answers are corroborated by multiple independent sources",
      "Open-core model: SDKs and integrations are Apache 2.0, verification engine is source-available",
      "Both have LangChain/CrewAI/MCP integrations — comparable distribution footprint",
    ],
    transparencyNote: "BrowseAI Dev uses Tavily as one of its underlying search providers. We add a verification + intelligence layer on top — claim extraction, cross-source verification, contradiction detection, and confidence scoring.",
    seoTitle: "BrowseAI Dev vs Tavily — AI Search API Comparison",
    seoDescription:
      "Compare BrowseAI Dev and Tavily for AI agent search. See how BrowseAI Dev adds native claim verification, confidence scores, and contradiction detection as a layer on top of web search.",
  },
  perplexity: {
    slug: "perplexity",
    name: "Perplexity AI",
    tagline: "Answer engine with citations",
    description:
      "Perplexity AI is an answer engine that provides natural language responses with inline citations. Their Sonar API offers programmatic access with multiple model options including Deep Research. Has official MCP server, Python SDK, and LangChain integration.",
    pricing: "Free tier, Pro $20/mo, API usage-based",
    strengths: [
      "Polished natural language answers with inline citations",
      "Official MCP server (@perplexity-ai/mcp-server) with web search, deep research, reasoning tools",
      "Official Python SDK (perplexityai on PyPI) and LangChain package (langchain-perplexity)",
      "Large consumer user base and brand recognition",
      "Multiple model options (Sonar, Sonar Pro, Deep Research, Reasoning)",
      "LlamaIndex support as LLM provider",
    ],
    limitations: [
      "No native claim-level verification pipeline documented in API",
      "No evidence-based confidence scores exposed in API responses",
      "No native contradiction detection across sources documented",
      "Core engine is closed-source (some SDKs are open-source)",
      "Locked to Perplexity's proprietary infrastructure",
    ],
    useCases: [
      "Consumer search replacement",
      "Quick Q&A with citations",
      "Research summaries for human readers",
    ],
    browseaiDifferentiators: [
      "Evidence-based confidence scores vs. no confidence scoring in Perplexity API",
      "Claim decomposition and individual verification vs. monolithic grounded answers",
      "Contradiction detection surfaces conflicting information across sources",
      "Both have MCP servers and LangChain integration — comparable distribution",
      "Open-core with source-available engine and free API keys — Perplexity's core is proprietary",
      "BrowseAI Dev is infrastructure for agents; Perplexity is primarily a consumer product with an API",
    ],
    seoTitle: "BrowseAI Dev vs Perplexity AI — AI Research Infrastructure Comparison",
    seoDescription:
      "Compare BrowseAI Dev and Perplexity AI for AI agents. BrowseAI Dev offers native claim verification and evidence-based confidence as open infrastructure vs. Perplexity's consumer answer engine.",
  },
  exa: {
    slug: "exa",
    name: "Exa",
    tagline: "Neural search API",
    description:
      "Exa (formerly Metaphor) is a neural search engine with semantic understanding. Has an /answer endpoint for AI-synthesized answers with citations, official MCP server, Python SDK (exa-py), and LangChain package (langchain-exa). Also publishes hallucination detection guides using Exa + external LLM tooling.",
    pricing: "Free tier (1K searches/mo), paid from $100/mo",
    strengths: [
      "Semantic neural search (not keyword-based)",
      "AI answer endpoint with citations and streaming",
      "Official MCP server (exa-mcp-server on GitHub)",
      "Official Python SDK (exa-py) and LangChain package (langchain-exa)",
      "Open-source SDKs and MCP server",
      "Open-source hallucination detection tool (uses Exa search + external LLM)",
    ],
    limitations: [
      "Hallucination detection is available as an open-source tool built on Exa + external LLM, not a native API feature",
      "No native confidence scoring for factual accuracy exposed in API",
      "No native cross-source consensus or contradiction detection documented",
      "Core search engine is closed-source (SDKs are open)",
      "Higher pricing than some alternatives",
    ],
    useCases: [
      "Semantic document retrieval",
      "Similar content discovery",
      "Research exploration and literature review",
    ],
    browseaiDifferentiators: [
      "Native claim verification pipeline built into the API — no external tooling needed",
      "Evidence-based confidence scores vs. no factual confidence scoring in API",
      "Contradiction detection and cross-source consensus as native features",
      "Both have MCP servers, Python SDKs, and LangChain — comparable distribution",
      "Open-core model: Apache 2.0 SDKs and integrations, source-available verification engine",
      "Exa has excellent semantic search — BrowseAI Dev adds the verification layer on top of search",
    ],
    transparencyNote: "Exa offers an open-source hallucination detection tool that combines Exa search with an external LLM. BrowseAI Dev's differentiation is that claim verification, confidence scoring, and contradiction detection are native built-in API features — not separate tools requiring external setup.",
    seoTitle: "BrowseAI Dev vs Exa — AI Search & Verification Comparison",
    seoDescription:
      "Compare BrowseAI Dev and Exa for AI agents. BrowseAI Dev adds native claim verification and confidence scoring as built-in API features vs. Exa's semantic neural search.",
  },
  you: {
    slug: "you",
    name: "You.com",
    tagline: "AI search platform",
    description:
      "You.com provides search APIs with AI-synthesized answers via Research API (controllable depth) and Express Agent. Has an official MCP server and LangChain integration.",
    pricing: "Free tier, paid plans from $100/mo",
    strengths: [
      "Research API with controllable research_effort (lite to frontier, 5 tiers)",
      "Official MCP server (hosted + local via npx @youdotcom-oss/mcp)",
      "AI-generated answers with citations",
      "LangChain integration (YouRetriever, YouSearchTool)",
      "Privacy-focused option available",
    ],
    limitations: [
      "No native claim verification pipeline documented in API",
      "No evidence-based confidence scores exposed in API responses",
      "No native contradiction detection documented",
      "Core engine is closed-source",
    ],
    useCases: [
      "General web search with AI synthesis",
      "Research with controllable depth",
      "RAG applications needing web context",
    ],
    browseaiDifferentiators: [
      "Native verification pipeline built into the API vs. unverified AI summaries",
      "Evidence-based confidence scores vs. no scoring",
      "Contradiction detection catches conflicting sources automatically",
      "Both have MCP servers and LangChain — comparable distribution",
      "Open-core with source-available engine and free API keys — You.com core is proprietary",
      "BrowseAI Dev is purpose-built for agents that need to verify before acting",
    ],
    seoTitle: "BrowseAI Dev vs You.com — AI Search API Comparison",
    seoDescription:
      "Compare BrowseAI Dev and You.com for AI agents. BrowseAI Dev provides native verification, confidence scores, and open-source infrastructure vs. You.com's AI search platform.",
  },
  brave: {
    slug: "brave",
    name: "Brave Search API",
    tagline: "Independent search index",
    description:
      "Brave Search offers an independent search index not sourced from Google or Bing. Their API provides web, news, and image search with AI Answers grounded in verifiable sources and LLM Context with relevance-scored content. Has an official MCP server and LangChain integration.",
    pricing: "Free tier (2K queries/mo), paid from $5/1K queries",
    strengths: [
      "Independent search index (not Google/Bing dependent)",
      "AI Answers grounded in verifiable sources",
      "LLM Context with relevance-scored extracted content",
      "Official MCP server (brave-search-mcp-server, MIT license)",
      "LangChain integration (BraveSearch tool, BraveSearchLoader)",
      "Strong privacy guarantees — no user tracking",
      "Competitive pricing ($5/1K queries)",
    ],
    limitations: [
      "No native claim-level verification pipeline documented in API",
      "No structured confidence scoring exposed in API responses",
      "Smaller index than Google/Bing-based alternatives",
      "Core search index is closed-source",
    ],
    useCases: [
      "Privacy-conscious web search",
      "Independent search index access",
      "Cost-effective bulk search operations",
    ],
    browseaiDifferentiators: [
      "BrowseAI Dev uses Brave as one of its underlying search providers for source diversity",
      "Native claim verification, contradiction detection, and consensus scoring built on top of search",
      "Evidence-backed confidence scores derived from verification data",
      "Brave provides excellent grounded search — BrowseAI Dev adds the verification intelligence layer",
      "Open-core model: Apache 2.0 SDKs and integrations, source-available verification engine with free API keys",
      "Both have MCP servers and LangChain integration — comparable distribution",
    ],
    transparencyNote: "BrowseAI Dev uses Brave Search as one of its underlying search providers for source diversity. We add a verification + intelligence layer on top — claim extraction, cross-source verification, contradiction detection, and confidence scoring. Brave is great at search; we add the trust layer.",
    seoTitle: "BrowseAI Dev vs Brave Search API — Verification Layer vs Raw Search",
    seoDescription:
      "Compare BrowseAI Dev and Brave Search API. BrowseAI Dev actually uses Brave as one of its search providers and adds native claim verification, confidence scoring, and contradiction detection on top.",
  },
};

// --- Detail Page ---

const AlternativeDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const competitor = slug ? COMPETITOR_DETAILS[slug] : null;

  if (!competitor) {
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
        <div className="terminal-card text-center space-y-4 p-8 rounded-lg border border-border hover:border-accent/20 transition-all duration-300">
          <h1 className="text-2xl font-bold">Competitor not found</h1>
          <Button onClick={() => navigate("/alternatives")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to comparisons
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={competitor.seoTitle}
        description={competitor.seoDescription}
        canonical={`/alternatives/${competitor.slug}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: competitor.seoTitle,
          description: competitor.seoDescription,
          url: `https://browseai.dev/alternatives/${competitor.slug}`,
          author: { "@type": "Organization", name: "BrowseAI Dev" },
        }}
      />

      <div className="min-h-screen bg-background relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-5 bg-background/80 backdrop-blur-sm border-b border-border/50"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/alternatives")}
            >
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/alternatives")}
            >
              All Comparisons
            </Button>
          </div>
        </motion.nav>

        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          {/* Header */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Badge variant="outline" className="text-xs border-accent/30 text-accent">
              vs. {competitor.name}
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              BrowseAI Dev vs. {competitor.name}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {competitor.description}
            </p>
            <p className="text-sm text-muted-foreground">
              Pricing: {competitor.pricing}
            </p>
          </motion.section>

          {/* Transparency note if applicable */}
          {competitor.transparencyNote && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="terminal-card gradient-border p-4 rounded-xl bg-accent/5 border border-accent/15 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-accent bg-accent/10 rounded mt-0.5 shrink-0" />
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Transparency:</strong>{" "}
                    {competitor.transparencyNote}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Side-by-side */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Competitor strengths */}
            <div className="terminal-card card-lift p-5 rounded-lg border border-border bg-card space-y-4 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <h3 className="font-medium text-lg">
                {competitor.name} strengths
              </h3>
              <ul className="space-y-2">
                {competitor.strengths.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent bg-accent/10 rounded-full mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitor limitations */}
            <div className="terminal-card card-lift p-5 rounded-lg border border-border bg-card space-y-4 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <h3 className="font-medium text-lg">
                {competitor.name} limitations
              </h3>
              <p className="text-xs text-muted-foreground">
                Based on publicly documented features. May offer similar capabilities through external tooling.
              </p>
              <ul className="space-y-2">
                {competitor.limitations.map((w) => (
                  <li
                    key={w}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Minus className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>

          {/* BrowseAI Dev differentiation */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="terminal-card gradient-border glow-pulse p-6 rounded-lg border border-accent/20 bg-accent/5 space-y-4 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
          >
            <h3 className="font-medium text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent bg-accent/10 rounded" />
              How BrowseAI Dev is differentiated
            </h3>
            <p className="text-xs text-muted-foreground">
              BrowseAI Dev is differentiated in offering native claim-level verification, contradiction detection,
              and cross-source consensus in a single agent-focused workflow.
            </p>
            <ul className="space-y-2">
              {competitor.browseaiDifferentiators.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </motion.section>

          {/* Best use cases */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="font-medium text-lg">
              When {competitor.name} might be the right choice
            </h3>
            <p className="text-sm text-muted-foreground">
              {competitor.name} is a strong product. If your use case doesn't require
              native verification, confidence scoring, or contradiction detection, it works well for:
            </p>
            <div className="flex flex-wrap gap-2">
              {competitor.useCases.map((uc) => (
                <Badge key={uc} variant="outline" className="text-xs border-accent/20 hover:border-accent/40 transition-all duration-300">
                  {uc}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              If your AI agent needs to <em>verify what it can trust before acting</em>,
              BrowseAI Dev's native verification pipeline is built for that.
            </p>
          </motion.section>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-[11px] text-muted-foreground/50 text-center max-w-2xl mx-auto leading-relaxed"
          >
            This comparison is based on publicly available documentation as of March 2026 and may contain inaccuracies.
            We are actively working to verify all claims on this page. Features described as limitations may exist
            in forms not found in official public documentation at the time of writing. Features and pricing
            may have changed. All trademarks belong to their respective owners. If you represent {competitor.name} and
            believe any information is inaccurate, please contact us at{" "}
            <a href="mailto:shreyassaw@gmail.com" className="underline hover:text-muted-foreground/70">shreyassaw@gmail.com</a>{" "}
            and we will update promptly.
          </motion.div>

          {/* CTA */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="terminal-card gradient-border text-center py-8 px-6 space-y-4 rounded-lg border border-accent/15 bg-accent/5 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
          >
            <h2 className="text-2xl font-bold">Try it yourself</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Run your own queries through BrowseAI Dev and see evidence-backed answers
              with claim verification, confidence scores, and verified sources.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => navigate("/playground")} className="glow-pulse">
                <Terminal className="w-4 h-4 mr-1.5 text-accent" />
                Playground
              </Button>
              <Button variant="outline" onClick={() => navigate("/docs")}>
                <BookOpen className="w-4 h-4 mr-1.5 text-accent bg-accent/10 rounded" />
                API Docs
              </Button>
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default AlternativeDetail;
