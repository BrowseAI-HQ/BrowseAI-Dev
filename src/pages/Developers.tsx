import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";
import {
  ArrowRight, GitBranch, Code2, Users, Lightbulb, Sparkles,
  Terminal, Globe, BookOpen, CheckCircle2, Rocket, Heart,
  ExternalLink, Shield, Brain, Layers, Trophy, GitCommitHorizontal, Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseLogo } from "@/components/BrowseLogo";
import { useContributors } from "@/hooks/useContributors";

const CONTRIBUTION_AREAS = [
  {
    icon: Globe,
    title: "Frontend",
    desc: "React + Vite + shadcn/ui. Build components, improve UX, add animations.",
    examples: ["Better mobile experience", "Dark/light theme toggle", "Result sharing UI"],
  },
  {
    icon: Layers,
    title: "Backend API",
    desc: "Fastify routes and services. Search, extraction, analysis pipelines.",
    examples: ["New extraction strategies", "Caching improvements", "Rate limiting"],
  },
  {
    icon: Terminal,
    title: "MCP Server",
    desc: "The npm package that powers Claude Desktop, Cursor, and Windsurf.",
    examples: ["New MCP tools", "Better error handling", "Streaming support"],
  },
  {
    icon: Brain,
    title: "Research & Prompts",
    desc: "Improve how we extract knowledge, verify claims, and score confidence.",
    examples: ["Multi-source verification", "Contradiction detection", "Better prompts"],
  },
  {
    icon: Code2,
    title: "Python SDK & Integrations",
    desc: "The browseaidev Python package, LangChain tools, and CrewAI integration.",
    examples: ["Async improvements", "New framework integrations", "SDK documentation"],
  },
  {
    icon: BookOpen,
    title: "Examples & Recipes",
    desc: "Agent recipes, tutorials, and demo projects that help developers get started fast.",
    examples: ["New agent recipes", "Video walkthroughs", "Framework-specific demos"],
  },
];

const ROADMAP_ITEMS = [
  {
    phase: "Shipped",
    title: "Research Infrastructure",
    desc: "Search, extract, cite. Every claim backed by a URL. Every answer has a confidence score.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Verification Engine",
    desc: "Multi-source consensus. Contradiction detection. Domain authority. Claims verified against actual source text.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Deep Mode",
    desc: "Iterative verification that keeps digging until it's confident. Adversarial stress-testing of every claim.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "SDKs & Integrations",
    desc: "Python SDK. MCP server. LangChain, CrewAI, LlamaIndex. Plug in however you build.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Research Memory",
    desc: "Persistent sessions. Knowledge accumulates across queries. Share, fork, and collaborate.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Query Planning",
    desc: "Complex questions decomposed into focused sub-queries. Simple questions skip the overhead.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Enterprise Ready",
    desc: "Plug into your internal data. Zero data retention. Your data never leaves your system.",
    done: true,
  },
  {
    phase: "Shipped",
    title: "Self-Learning Pipeline",
    desc: "Confidence calibrated from real feedback. Domain authority that improves with every query.",
    done: true,
  },
  {
    phase: "In Progress",
    title: "Knowledge Graph",
    desc: "Entity extraction. Relationship mapping. Queryable knowledge from every search.",
    done: false,
  },
  {
    phase: "Coming Soon",
    title: "Academic & Broader Sources",
    desc: "arXiv, Semantic Scholar, code search. Research beyond the open web.",
    done: false,
  },
  {
    phase: "Coming Soon",
    title: "Purpose-Built Verification Model",
    desc: "Custom-trained. Domain-calibrated. 10x faster than general-purpose.",
    done: false,
  },
];

const GOOD_FIRST_ISSUES = [
  "Add loading skeleton components for search results",
  "Improve error messages when API keys are invalid",
  "Add keyboard shortcuts (Cmd+K to search)",
  "Write unit tests for the extraction service",
  "Add a 'copy citation' button to result cards",
  "Implement result pagination",
];

const Developers = () => {
  const navigate = useNavigate();
  const { contributors, loading: contributorsLoading } = useContributors();

  return (
    <>
    <SEO
      title="Developers — Contribute to Open Source AI Research Infra"
      description="Contribute to BrowseAI Dev. Open source research infrastructure for AI agents. See the roadmap, contribution areas, and how to get started."
      canonical="/developers"
    />
    <div className="min-h-screen">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50"
      >
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI Dev" className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-tight">BrowseAI Dev</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="Home" className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/playground")}>
            <Terminal className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Playground</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground text-xs font-medium" onClick={() => navigate("/developers")}>
            <Rocket className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Developers</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/recipes")}>
            <BrowseLogo className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Recipes</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" asChild>
            <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener">
              <Github className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="min-h-[50vh] sm:min-h-[70vh] flex flex-col items-center justify-center px-6 pt-20 relative">
        <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl w-full text-center space-y-6"
        >
          <Badge variant="outline" className="text-xs font-normal">
            Open Source
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Build the research infra
            <br />
            <span className="text-gradient text-shimmer">for AI agents</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            BrowseAI Dev is Grounded Intelligence — an open-source research engine that gives AI agents the ability to search the web,
            extract evidence, and produce cited answers. No hallucinations. Just facts.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button className="gap-2" asChild>
              <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener">
                <GitBranch className="w-3.5 h-3.5" />
                View on GitHub
              </a>
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener">
                Join Discord
              </a>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Contributors Leaderboard — front and center */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-accent" />
              <h2 className="text-2xl md:text-3xl font-bold">Top Contributors</h2>
            </div>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-10">
              The people making AI more honest. Every merged PR earns your place here.
            </p>

            {contributorsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
              </div>
            ) : contributors.length > 0 ? (
              <>
                {/* Top 3 podium */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {contributors.slice(0, 3).map((contributor, i) => {
                    const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
                    const percentage = Math.round((contributor.contributions / totalCommits) * 100);
                    const medals = ["text-amber-400 border-amber-400/40", "text-gray-400 border-gray-400/40", "text-amber-600 border-amber-600/40"];
                    const medalLabels = ["1st", "2nd", "3rd"];
                    const bgColors = ["bg-amber-400/5", "bg-gray-400/5", "bg-amber-600/5"];
                    return (
                      <motion.a
                        key={contributor.login}
                        href={contributor.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className={`flex flex-col items-center gap-3 p-6 rounded-xl border ${bgColors[i]} ${medals[i].split(" ")[1]} hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 group`}
                      >
                        <Badge variant="outline" className={`text-xs ${medals[i]}`}>
                          {medalLabels[i]}
                        </Badge>
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className={`w-16 h-16 rounded-full border-2 ${medals[i].split(" ")[1]} group-hover:border-accent/30 transition-colors`}
                        />
                        <span className="font-semibold text-sm group-hover:text-accent transition-colors">
                          {contributor.login}
                        </span>
                        <div className="w-full space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-mono">{contributor.contributions} commits</span>
                            <span>{percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                              className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-400" : "bg-amber-600"}`}
                            />
                          </div>
                        </div>
                      </motion.a>
                    );
                  })}
                </div>

                {/* Rest of contributors */}
                {contributors.length > 3 && (
                  <div className="space-y-2">
                    {contributors.slice(3).map((contributor, i) => {
                      const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
                      const percentage = Math.round((contributor.contributions / totalCommits) * 100);
                      return (
                        <motion.a
                          key={contributor.login}
                          href={contributor.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 group"
                        >
                          <span className="text-xs font-mono text-muted-foreground w-6 text-right">
                            #{i + 4}
                          </span>
                          <img
                            src={contributor.avatar_url}
                            alt={contributor.login}
                            className="w-8 h-8 rounded-full border border-border group-hover:border-accent/30 transition-colors"
                          />
                          <span className="font-medium text-sm group-hover:text-accent transition-colors flex-shrink-0">
                            {contributor.login}
                          </span>
                          <div className="flex-1 mx-2 hidden sm:block">
                            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent/40"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                            <GitCommitHorizontal className="w-3 h-3" />
                            <span className="font-mono">{contributor.contributions}</span>
                          </div>
                        </motion.a>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Be the first contributor! Fork the repo and submit a PR.
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* The Story */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Heart className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">The Story</h2>
            </div>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p className="text-lg">
                I built BrowseAI Dev because I was tired of AI making things up.
              </p>
              <p>
                As a developer using AI assistants daily, I kept running into the same problem: the AI would confidently
                cite sources that don't exist, reference papers that were never written, and state "facts" that are completely wrong.
                It sounds right. It reads well. But it's fiction.
              </p>
              <p>
                I use AI agents — Claude Code, Cursor, Codex — to build code and ship products every day.
                Before writing code or building anything, I always want to research first: what's the best approach,
                what libraries exist, what patterns work. So I tell my agents to research before they code.
                But they hallucinate. They recommend packages that don't exist, reference APIs that were deprecated years ago,
                and confidently describe solutions that simply don't work.
                The result? Either the product gets built wrong and I discover it later, or I end up doing the
                research myself anyway — defeating the whole point of using AI to move faster.
              </p>
              <p>
                The cost of this isn't just wrong answers — it's eroded trust. When you can't tell if an AI response
                is real or hallucinated, you end up manually verifying everything anyway. That defeats the purpose.
              </p>
              <p>
                BrowseAI Dev takes a different approach: <span className="text-foreground font-medium">every answer goes through a verification pipeline</span>.
                It searches the real web, fetches real pages, extracts real quotes, and links every claim back to its source.
                If it can't find evidence, it says so. Now when I tell my AI agents to research something,
                they can use BrowseAI Dev to actually verify their findings against real sources before writing a single line of code.
              </p>
              <p>
                This is open source because research infrastructure for AI shouldn't be owned by one company.
                It should be transparent, auditable, and community-driven.
              </p>
              <p className="text-foreground font-medium">
                If you believe AI should be honest, you're in the right place.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How I Use It */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Code2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">How to Use It</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">Four ways to get started</h3>

            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">1</Badge>
                  <span className="font-semibold">Web — Try it now</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Go to the playground page, type a question, and see the full evidence pipeline in action.
                  No signup needed. Bring your own API keys for unlimited usage.
                </p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/playground")}>
                  Open Playground <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">2</Badge>
                  <span className="font-semibold">MCP Server — For AI assistants</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Install as an MCP server for Claude Desktop, Cursor, or Windsurf. Your AI assistant
                  gets 13 research tools it can call to verify information.
                </p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary">
                  <Terminal className="w-4 h-4 text-accent" />
                  <code className="text-sm font-mono">npx browseai-dev setup</code>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">3</Badge>
                  <span className="font-semibold">Python SDK — For agents & scripts</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Core SDK + dedicated framework packages for LangChain, CrewAI, and LlamaIndex.
                  Sync and async support built in.
                </p>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary mb-3">
                  <Terminal className="w-4 h-4 text-accent" />
                  <code className="text-sm font-mono">pip install browseaidev</code>
                </div>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`from browseaidev import BrowseAIDev

client = BrowseAIDev(api_key="bai_xxx")
result = client.ask("What causes aurora borealis?")
print(result.answer, result.confidence)`}</pre>
              </div>

              <div className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">4</Badge>
                  <span className="font-semibold">REST API — For any language</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Use the REST API from any HTTP client. Self-host or use the hosted version.
                </p>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`curl -X POST https://browseai.dev/api/browse/answer \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: bai_your_key" \\
  -d '{"query": "What causes aurora borealis?", "depth": "deep"}'

# depth: "fast" (default) | "thorough" | "deep"`}</pre>
              </div>

              <div className="p-5 rounded-xl bg-card border border-accent/30 glow-pulse hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] border-accent/50 text-accent">NEW</Badge>
                  <span className="font-semibold">Clarity — Anti-Hallucination Answer Engine</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Send any prompt through <code className="text-xs bg-secondary px-1 py-0.5 rounded">browse_clarity</code> — it auto-detects intent, identifies hallucination risks, and applies anti-hallucination grounding techniques (CoVe, citation-verify, quote extraction). Three modes: <strong>Prompt</strong> (<code className="text-xs bg-secondary px-1 py-0.5 rounded">mode: "prompt"</code>) returns enhanced prompts only — use when your own LLM should answer. <strong>Answer</strong> (default) gives a fast LLM-only answer with reduced hallucinations. <strong>Verified</strong> (<code className="text-xs bg-secondary px-1 py-0.5 rounded">mode: "verified"</code>) also runs the web pipeline and fuses the best of both into one source-backed answer. Works with any agent.
                </p>
                <pre className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto">{`# MCP — prompt mode (get enhanced prompts for your own LLM)
browse_clarity({ prompt: "What are the side effects of metformin?", mode: "prompt" })
# Returns: systemPrompt, userPrompt, techniques, risks (no LLM call)

# MCP — answer mode (LLM answers with anti-hallucination, default)
browse_clarity({ prompt: "What are the side effects of metformin?" })

# MCP — verified mode (LLM + web sources fused)
browse_clarity({ prompt: "What are the side effects of metformin?", mode: "verified" })

# Python — all three modes
prompts = client.clarity("...", mode="prompt")   # Enhanced prompts only
answer  = client.clarity("...", mode="answer")   # LLM answer
verified = client.clarity("...", mode="verified") # LLM + web fusion

# REST API
curl -X POST https://browseai.dev/api/browse/clarity \\
  -H "X-API-Key: bai_xxx" -H "Content-Type: application/json" \\
  -d '{"prompt": "Is coffee good for you?", "mode": "verified"}'`}</pre>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agent Recipes CTA */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-xl bg-accent/5 border border-accent/20 text-center glow-pulse"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <BrowseLogo className="w-5 h-5 text-accent animate-float" />
              <h3 className="text-xl font-bold">Agent Recipes</h3>
            </div>
            <p className="text-muted-foreground mb-5 max-w-lg mx-auto">
              Ready-to-run examples for research agents, LangChain, CrewAI, hallucination detection, and more.
            </p>
            <Button className="gap-2" onClick={() => navigate("/recipes")}>
              Browse Recipes <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Tutorials & Examples */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Lightbulb className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Tutorials</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Build something real</h3>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Full project tutorials with working code. Each one shows a different way to use BrowseAI Dev.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "Coding Agent",
                  desc: "Researches before writing code. Never recommends deprecated libraries.",
                  tags: ["Python SDK", "Thorough Mode", "Code Research"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/coding-agent",
                },
                {
                  title: "Support Agent",
                  desc: "Verifies answers before responding. Escalates when confidence is low.",
                  tags: ["Fast Mode", "Confidence", "Escalation"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/support-agent",
                },
                {
                  title: "Content Agent",
                  desc: "Writes blog posts where every stat has a citation and confidence score.",
                  tags: ["Thorough Mode", "Citations", "Writing"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/content-agent",
                },
                {
                  title: "Fact-Checker Bot",
                  desc: "Discord bot that verifies any claim with !verify and shows evidence vs hallucination with !compare.",
                  tags: ["Discord", "Thorough Mode", "Compare"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/fact-checker-bot",
                },
                {
                  title: "Is This True?",
                  desc: "Minimal web app — paste any sentence, get a confidence score, sources, and contradictions. One input, one answer.",
                  tags: ["FastAPI", "Web App", "Shareable"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/is-this-true",
                },
                {
                  title: "Debate Settler",
                  desc: "Two claims go in, evidence decides the winner. Side-by-side comparison with scoring breakdown.",
                  tags: ["CLI", "Thorough Mode", "Contradictions"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/debate-settler",
                },
                {
                  title: "Docs Verifier",
                  desc: "Verify every factual claim in your README or docs. Flags outdated stats and wrong assertions. CI-friendly.",
                  tags: ["CI/CD", "Extract", "Automation"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/docs-verifier",
                },
                {
                  title: "Podcast Prep",
                  desc: "Research brief builder — give it a guest and topic, get verified facts, contradictions, and suggested questions.",
                  tags: ["Sessions", "Recall", "Async"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples/podcast-prep",
                },
                {
                  title: "More Coming Soon",
                  desc: "Competitive intel agent, Wikipedia trust scorer, newsletter writer with citations, and more.",
                  tags: ["Contribute", "Ideas Welcome"],
                  link: "https://github.com/BrowseAI-HQ/BrowseAI-Dev/tree/main/examples",
                },
              ].map((tutorial, i) => (
                <motion.a
                  key={tutorial.title}
                  href={tutorial.link}
                  target="_blank"
                  rel="noopener"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 group"
                >
                  <span className="font-semibold text-sm group-hover:text-accent transition-colors block mb-2">
                    {tutorial.title}
                  </span>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tutorial.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tutorial.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-24 px-6 border-t border-border relative grid-bg grid-bg-fade">
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Rocket className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Roadmap</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-10 text-shimmer">What we've built. What's next.</h3>

            {/* Timeline */}
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 via-accent/30 to-border" />

              <div className="space-y-1">
                {ROADMAP_ITEMS.map((item, i) => {
                  const isShipped = item.phase === "Shipped";
                  const isInProgress = item.phase === "In Progress";
                  return (
                    <motion.div
                      key={`${item.phase}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: Math.min(i * 0.04, 0.35) }}
                      className="relative pl-8 py-3 group"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-[18px] w-[15px] h-[15px] rounded-full border-2 transition-all duration-300 ${
                        isShipped ? "bg-accent/80 border-accent shadow-[0_0_8px_rgba(var(--accent-rgb,56,189,128),0.4)]" :
                        isInProgress ? "bg-amber-400/80 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)] animate-pulse" :
                        "bg-background border-border group-hover:border-blue-400/50"
                      }`} />

                      <div className={`rounded-lg px-4 py-3 transition-all duration-300 ${
                        isShipped
                          ? "hover:bg-accent/5"
                          : isInProgress
                            ? "bg-amber-400/5 border border-amber-400/20 hover:border-amber-400/40"
                            : "bg-card/50 border border-border hover:border-blue-400/30"
                      }`}>
                        <div className="flex items-center gap-2.5">
                          {isShipped && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                          {!isShipped && (
                            <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 ${
                              isInProgress ? "text-amber-400 border-amber-400/30" : "text-blue-400 border-blue-400/30"
                            }`}>
                              {item.phase}
                            </Badge>
                          )}
                          <span className={`font-semibold ${isShipped ? "text-foreground/90" : "text-foreground"}`}>{item.title}</span>
                        </div>
                        <p className={`text-sm mt-1 ${isShipped ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{item.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contribute */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Contribute</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Help us build this</h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              BrowseAI Dev is built by developers, for developers. Here's where you can make an impact.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {CONTRIBUTION_AREAS.map((area, i) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className="p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                    <area.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-semibold">{area.title}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{area.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {area.examples.map((ex) => (
                    <span key={ex} className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                      {ex}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Good First Issues */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-accent" />
              <h4 className="font-semibold">Good first issues</h4>
            </div>
            <div className="space-y-2">
              {GOOD_FIRST_ISSUES.map((issue) => (
                <div key={issue} className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 sm:mt-0 text-emerald-400 border-emerald-400/30">
                    good first issue
                  </Badge>
                  <span className="text-sm text-muted-foreground">{issue}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agent Skills */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Agent Skills</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Teach your agents to research</h3>
            <p className="text-muted-foreground mb-8">
              Pre-built skills that teach AI coding agents when and how to use BrowseAI Dev. Works with Claude Code, Codex, Gemini CLI, Cursor, and more.
            </p>

            <div className="px-4 py-3 rounded-lg bg-secondary mb-8">
              <code className="text-sm font-mono text-muted-foreground">npx skills add BrowseAI-HQ/browseAIDev_Skills</code>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { name: "browse-research", desc: "Evidence-backed answers with citations and confidence scores" },
                { name: "browse-fact-check", desc: "Compare raw LLM vs evidence-backed, verify claims" },
                { name: "browse-extract", desc: "Structured claim extraction from any URL" },
                { name: "browse-sessions", desc: "Multi-query research with persistent knowledge" },
                { name: "browse-deep-dive", desc: "Multi-step agentic research with reasoning chains and gap analysis" },
                { name: "browse-compare-claims", desc: "Settle factual disputes — evidence vs raw LLM side-by-side" },
                { name: "browse-monitor", desc: "Track evolving topics over time, diff against prior knowledge" },
                { name: "browse-cite", desc: "Generate formatted citations (APA/MLA) with authority scores" },
                { name: "browse-clarity", desc: "Clarity — anti-hallucination answer engine with optional web verification" },
              ].map((skill) => (
                <a
                  key={skill.name}
                  href={`https://github.com/BrowseAI-HQ/browseAIDev_Skills/tree/main/${skill.name}`}
                  target="_blank"
                  rel="noopener"
                  className="p-4 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
                >
                  <span className="text-sm font-semibold text-foreground block mb-1">{skill.name}</span>
                  <span className="text-xs text-muted-foreground">{skill.desc}</span>
                </a>
              ))}
            </div>

            <a
              href="https://github.com/BrowseAI-HQ/browseAIDev_Skills"
              target="_blank"
              rel="noopener"
              className="text-sm text-accent hover:underline"
            >
              View all skills on GitHub →
            </a>
          </motion.div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Getting Started</h2>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-8">How to contribute</h3>

            <div className="space-y-4">
              {[
                { step: "1", cmd: "# Fork on GitHub, then:", label: "Fork the repo", isNote: true },
                { step: "2", cmd: "git clone https://github.com/YOUR_USERNAME/BrowseAI-Dev.git && cd BrowseAI-Dev", label: "Clone your fork" },
                { step: "3", cmd: "pnpm install && cp .env.example .env", label: "Install & configure" },
                { step: "4", cmd: "git checkout -b feat/your-feature", label: "Create a branch" },
                { step: "5", cmd: "pnpm dev", label: "Start development" },
                { step: "6", cmd: "pnpm lint && pnpm test", label: "Run checks" },
                { step: "7", cmd: "# Push your branch and open a PR against main", label: "Submit a Pull Request", isNote: true },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0 mt-1 text-[10px] px-1.5">{item.step}</Badge>
                  <div className="flex-1">
                    <span className="text-sm font-medium block mb-1">{item.label}</span>
                    <div className="px-4 py-2.5 rounded-lg bg-secondary overflow-x-auto">
                      <code className="text-xs font-mono text-muted-foreground whitespace-nowrap">{item.cmd}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Branch naming:</span>{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">feat/...</code> for features,{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">fix/...</code> for bugs,{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">docs/...</code> for documentation.
                One feature per PR — keep changes focused.
              </p>
            </div>

            <div className="mt-4 p-5 rounded-xl bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                  <Shield className="w-5 h-5 text-accent" />
                </div>
                <span className="font-semibold text-sm">CI/CD runs automatically</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Every PR runs lint, type-check, build, and tests via GitHub Actions.
                Once approved and merged, Vercel deploys the app, Supabase migrations run, and the MCP
                package auto-publishes to npm. You just write code — we handle the rest.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Let's build <span className="text-shimmer">honest AI</span> together</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Every contribution — whether it's a bug fix, a new feature, or a better prompt — makes
              AI more trustworthy for everyone.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button className="gap-2" asChild>
                <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener">
                  <Github className="w-3.5 h-3.5" />
                  Start Contributing
                </a>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">
                  <BookOpen className="w-3.5 h-3.5" />
                  Read the Guide
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="text-sm font-semibold">BrowseAI Dev</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="https://github.com/BrowseAI-HQ/BrowseAI-Dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="https://discord.gg/ubAuT4YQsT" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
            <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Home</button>
            <button onClick={() => navigate("/playground")} className="hover:text-foreground transition-colors">Playground</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-foreground transition-colors">Privacy</button>
            <button onClick={() => navigate("/terms")} className="hover:text-foreground transition-colors">Terms</button>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Developers;
