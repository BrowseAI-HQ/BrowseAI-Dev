import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrowseBadge } from "@/components/BrowseBadge";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { getSharedSession, type KnowledgeEntry } from "@/lib/api/sessions";

const SharedSession = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [sessionData, setSessionData] = useState<{
    session: { name: string; claimCount: number; queryCount: number };
    entries: KnowledgeEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) return;
    getSharedSession(shareId)
      .then((data) => {
        setSessionData(data);
        document.title = `BrowseAI Dev: ${data.session.name}`;
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shareId]);

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI" className="w-4 h-4" />
            <span className="font-semibold text-sm">BrowseAI Dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionData && (
            <Badge variant="outline" className="text-xs text-accent border-accent/30">
              <Brain className="w-3 h-3 mr-1" />
              Shared Research
            </Badge>
          )}
          {!authLoading && (user ? <UserMenu /> : <LoginModal />)}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center"
          >
            {error}
          </motion.div>
        )}

        {sessionData && (
          <>
            {/* Session header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                <Brain className="w-7 h-7 text-accent" />
              </div>
              <h1 className="text-2xl font-bold">{sessionData.session.name}</h1>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span>{sessionData.session.claimCount} verified claims</span>
                <span>{sessionData.session.queryCount} queries</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                This research session was built with BrowseAI Dev — evidence-backed research with verified claims and confidence scores.
              </p>
            </motion.div>

            {/* Knowledge entries */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-accent" />
                Research Knowledge ({sessionData.entries.length} claims)
              </h2>

              {sessionData.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  This session has no knowledge entries yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessionData.entries.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * Math.min(i, 10) }}
                      className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          entry.verified ? "text-emerald-400" : "text-muted-foreground/30"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{entry.claim}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            from: {entry.originQuery}
                          </span>
                          {entry.verified && (
                            <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                              Verified
                            </Badge>
                          )}
                          {entry.confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(entry.confidence * 100)}% confidence
                            </span>
                          )}
                          {entry.sources.length > 0 && (
                            <span className="text-[10px] text-accent">
                              {entry.sources.length} source{entry.sources.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Build your own research sessions with evidence-backed claims and persistent knowledge.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate("/sessions")}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                >
                  Start Researching
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="gap-2"
                >
                  Try a Quick Search
                </Button>
              </div>
              <BrowseBadge />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default SharedSession;
