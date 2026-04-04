import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LayoutDashboard, Activity, History, Settings, Search, FileText, GitCompare, ExternalLink, CheckCircle2, Sparkles, Shield, Key, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import {
  fetchUserStats,
  fetchUserHistory,
  checkWaitlistStatus,
  joinWaitlist,
  type UserStats,
  type QueryHistoryItem,
} from "@/lib/api/apiKeys";

const TOOL_ICONS: Record<string, typeof Search> = {
  search: Search,
  answer: Sparkles,
  extract: FileText,
  compare: GitCompare,
  open: ExternalLink,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([fetchUserStats(), fetchUserHistory()]);
      setStats(s);
      setHistory(h);
    } catch {
      // Silently fail — stats/history not critical
    } finally {
      setLoadingData(false);
    }
  }, []);

  const checkWaitlist = useCallback(async () => {
    try {
      const data = await checkWaitlistStatus();
      setOnWaitlist(data.onWaitlist);
      setIsAdmin(data.isAdmin);
    } catch {
      // Silently fail
    }
  }, []);

  const handleJoinWaitlist = async () => {
    if (!user?.email) return;
    setJoiningWaitlist(true);
    try {
      await joinWaitlist(user.email, "dashboard");
      setOnWaitlist(true);
    } catch {
      // Silently fail
    } finally {
      setJoiningWaitlist(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
      checkWaitlist();
    }
  }, [user, loadData, checkWaitlist]);

  useEffect(() => {
    if (!loading && user && window.location.hash === "#api-keys") {
      setTimeout(() => {
        document.getElementById("api-keys")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/logo.svg" alt="BrowseAI Dev" className="w-4 h-4" />
            <span className="font-semibold text-sm">BrowseAI Dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-accent animate-float" />
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <Badge variant="outline" className="text-xs">Free</Badge>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-xs gap-1.5"
                onClick={() => navigate("/admin")}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Button>
            )}
          </div>

          {/* Welcome banner for new users without API keys */}
          {!loadingData && stats?.thisMonth === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl bg-accent/5 border border-accent/20 border-glow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 glow-pulse">
                  <Key className="w-5 h-5 text-accent" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Welcome! Create your BAI key to get started</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your Tavily and OpenRouter keys below to generate a BAI key. This gives you 100 premium queries/day with semantic verification, multi-source search, and more.
                  </p>
                  <button
                    onClick={() => document.getElementById("api-keys")?.scrollIntoView({ behavior: "smooth" })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 mt-2"
                  >
                    Create your key <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-float" />
                  Queries This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {loadingData ? <span className="animate-pulse">...</span> : (stats?.thisMonth ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalQueries ? `${stats.totalQueries} total` : "Make your first query"}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History className="w-5 h-5 animate-float" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {loadingData ? <span className="animate-pulse">...</span> : history.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {history.length > 0 ? `Last: ${timeAgo(history[0].created_at)}` : "No queries yet"}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Settings className="w-5 h-5 animate-float" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-1">{user.user_metadata?.full_name || "User"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Query History */}
          {history.length > 0 && (
            <Card className="hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-accent" />
                  Query History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-64 sm:max-h-96 overflow-y-auto">
                  {history.map((item) => {
                    const Icon = TOOL_ICONS[item.tool] || Sparkles;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/share/${item.id}`)}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors w-full text-left cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{item.query}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {item.tool}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                          {timeAgo(item.created_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div id="api-keys">
            <ApiKeyManager />
          </div>

          <Card className="border-amber-400/20 hover:border-accent/20 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                BrowseAI Dev Pro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Coming soon — everything in Free, plus unlimited premium verification with no quotas.</p>
              <ul className="text-sm space-y-2 text-muted-foreground mb-4">
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Unlimited premium verification</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> No quotas, no fallback</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Managed keys — zero configuration</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> 15+ sources per query</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Multi-model verification</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Priority queue &amp; webhooks</li>
                <li className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Team seats &amp; shared access</li>
              </ul>
              {onWaitlist ? (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  You're on the waitlist — we'll notify you when it's ready
                </div>
              ) : (
                <Button
                  onClick={handleJoinWaitlist}
                  disabled={joiningWaitlist}
                  className="w-full"
                  variant="outline"
                >
                  {joiningWaitlist ? "Joining..." : "Join the Pro Waitlist"}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
