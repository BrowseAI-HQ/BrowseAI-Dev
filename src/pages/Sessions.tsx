import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Plus, Trash2, Brain, Clock, FileText,
  ChevronLeft, CheckCircle2, Send, Loader2, Share2, Check, Link2, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/LoginModal";
import { SessionPipelineProgress } from "@/components/results/SessionPipelineProgress";
import { DepthToggle, isDepthBlocked, formatResetTime } from "@/components/DepthToggle";
import {
  createSession, listSessions, deleteSession, sessionAsk, getSessionKnowledge,
  shareSession,
  type Session, type KnowledgeEntry, type SessionAskResult, type SessionQuota,
} from "@/lib/api/sessions";

type View = "list" | "session";

const Sessions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("list");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<"fast" | "thorough" | "deep">("fast");
  const [asking, setAsking] = useState(false);
  const [lastResult, setLastResult] = useState<SessionAskResult | null>(null);
  const [quota, setQuota] = useState<SessionQuota | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);

  // Share state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const result = await listSessions();
      setSessions(result);
    } catch {
      // Silently fail — empty list
    } finally {
      setLoadingSessions(false);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load knowledge for active session
  const loadKnowledge = useCallback(async () => {
    if (!activeSession) return;
    try {
      const result = await getSessionKnowledge(activeSession.id, 100);
      setKnowledge(result.entries || []);
    } catch {
      setKnowledge([]);
    }
  }, [activeSession]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const handleCreateSession = async () => {
    const name = newSessionName.trim() || `Research ${new Date().toLocaleDateString()}`;
    setCreating(true);
    try {
      const session = await createSession(name);
      setSessions((prev) => [session, ...prev]);
      setNewSessionName("");
      openSession(session);
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) {
        setView("list");
        setActiveSession(null);
      }
    } catch {
      // Handle error
    }
  };

  const openSession = (session: Session) => {
    setActiveSession(session);
    setView("session");
    setLastResult(null);
    setQuery("");
    setShareUrl(null);
  };

  const handleAsk = async () => {
    if (!query.trim() || !activeSession || asking) return;
    setAsking(true);
    setLastResult(null);
    try {
      const result = await sessionAsk(activeSession.id, query.trim(), depth);
      if (result.quota) setQuota(result.quota);
      setLastResult(result);
      setQuery("");
      // Refresh knowledge and session data
      loadKnowledge();
      // Update session counts locally
      setActiveSession((prev) =>
        prev ? {
          ...prev,
          queryCount: prev.queryCount + 1,
          claimCount: prev.claimCount + (result.session.newClaimsStored || 0),
        } : prev
      );
    } catch {
      // Handle error
    } finally {
      setAsking(false);
    }
  };

  const handleShare = async () => {
    if (!activeSession || sharing) return;
    setSharing(true);
    try {
      const result = await shareSession(activeSession.id);
      const url = `${window.location.origin}/session/share/${result.shareId}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // Handle error
    } finally {
      setSharing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 grid-bg grid-bg-fade pointer-events-none" />
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-8 py-5 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.svg" alt="BrowseAI Dev" className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-tight hidden sm:inline">BrowseAI Dev</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
          <UserMenu />
        </div>
      </nav>

      <div className="pt-20 px-4 sm:px-8 max-w-5xl mx-auto">
        {view === "list" ? (
          /* ===== SESSION LIST ===== */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Research Sessions</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Build knowledge across multiple queries. Each session remembers what you've researched.
                </p>
              </div>
            </div>

            {/* Create new session */}
            <div className="flex items-center gap-3 mb-8 terminal-card p-4 rounded-xl">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Session name (optional)"
                  aria-label="Session name"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                  className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                />
              </div>
              <Button
                onClick={handleCreateSession}
                disabled={creating}
                className="bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-4 text-sm font-semibold gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                New Session
              </Button>
            </div>

            {/* Session list */}
            {loadingSessions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-16 terminal-card rounded-xl">
                <Brain className="w-12 h-12 text-accent/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No sessions yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Create a research session to start building persistent knowledge.
                  Each query in a session recalls and builds on previous findings.
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list">
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    role="listitem"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border card-lift hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 cursor-pointer group"
                    onClick={() => openSession(session)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 glow-pulse">
                      <Brain className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">{session.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {session.claimCount} claims
                        </span>
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {session.queryCount} queries
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete session"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* ===== ACTIVE SESSION ===== */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Back + session header */}
            <div className="flex items-center gap-3 mb-6">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => { setView("list"); loadSessions(); }}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex-1">
                <h1 className="text-lg font-bold">{activeSession?.name}</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{activeSession?.claimCount} claims</span>
                  <span>{activeSession?.queryCount} queries</span>
                </div>
              </div>
              {/* Share button */}
              {knowledge.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleShare}
                  disabled={sharing}
                >
                  {copiedShare ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : sharing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{copiedShare ? "Link Copied!" : "Share Session"}</span>
                </Button>
              )}
            </div>

            {/* Share URL display */}
            {shareUrl && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/20 gradient-border"
              >
                <Link2 className="w-3.5 h-3.5 text-accent shrink-0" />
                <code className="text-xs text-accent flex-1 truncate">{shareUrl}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopiedShare(true);
                    setTimeout(() => setCopiedShare(false), 2000);
                  }}
                >
                  {copiedShare ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </motion.div>
            )}

            {/* Ask input */}
            <div className="relative mb-6 terminal-card rounded-xl p-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors z-10" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  placeholder="Ask a question (recalls prior knowledge automatically)..."
                  disabled={asking}
                  className="w-full h-12 pl-12 pr-20 sm:pr-32 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <DepthToggle depth={depth} setDepth={setDepth} quota={quota} size="sm" />
                  <Button
                    onClick={handleAsk}
                    disabled={!query.trim() || asking || isDepthBlocked(depth, !!user, quota)}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-4 h-8 text-sm font-semibold gap-2"
                  >
                    {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="hidden sm:inline">{asking ? "Researching..." : "Ask"}</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Pipeline progress while asking */}
            {asking && <SessionPipelineProgress depth={depth} />}

            {/* Last result */}
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-5 rounded-xl bg-card border border-border gradient-border card-lift hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="text-xs text-accent border-accent/30">
                    {Math.round(lastResult.confidence * 100)}% confidence
                  </Badge>
                  {lastResult.session.recalledClaims > 0 && (
                    <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30">
                      <Brain className="w-3 h-3 mr-1" />
                      {lastResult.session.recalledClaims} recalled
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    +{lastResult.session.newClaimsStored} new claims
                  </Badge>
                  {lastResult.quota && (
                    <Badge variant="outline" className={`text-[10px] ${lastResult.quota.premiumActive ? "text-emerald-400 border-emerald-400/30" : "text-amber-400 border-amber-500/30"}`}>
                      {lastResult.quota.premiumActive ? "Premium" : "Standard"} · {lastResult.quota.used}/{lastResult.quota.limit}
                    </Badge>
                  )}
                  {depth === "deep" && (lastResult as any).effectiveDepth && (lastResult as any).effectiveDepth !== "deep" && (
                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                      Ran as thorough — deep mode {user ? `quota exhausted, resets in ${formatResetTime(lastResult.quota?.resetsInSeconds)}` : "requires sign in"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{lastResult.answer}</p>

                {/* Sources */}
                {lastResult.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</span>
                    <div className="mt-2 space-y-1.5">
                      {lastResult.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener"
                          className="flex items-start gap-2 text-xs text-muted-foreground hover:text-accent transition-colors"
                        >
                          <span className="text-accent shrink-0">[{i + 1}]</span>
                          <span className="truncate">{s.title} — {s.domain}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trace */}
                <div className="mt-4 pt-3 border-t border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lastResult.trace.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-accent/5 border border-accent/10 text-muted-foreground">
                        {t.step} <span className="hidden sm:inline">{t.duration_ms > 0 ? `${(t.duration_ms / 1000).toFixed(1)}s` : ""}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Knowledge base */}
            <div className="terminal-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center glow-pulse">
                  <Brain className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-wider">Session Knowledge</h2>
                <span className="text-xs text-muted-foreground">({knowledge.length} claims)</span>
              </div>

              {knowledge.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50">
                  <p className="text-sm">No knowledge yet. Ask a question to start building.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledge.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${entry.verified ? "text-emerald-400" : "text-muted-foreground/30"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{entry.claim}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            from: {entry.originQuery}
                          </span>
                          {entry.sources.length > 0 && (
                            <span className="text-[10px] text-accent">
                              {entry.sources.length} source{entry.sources.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
