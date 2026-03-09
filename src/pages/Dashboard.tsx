import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, LayoutDashboard, Activity, History, Settings, Search, FileText, GitCompare, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import {
  fetchUserStats,
  fetchUserHistory,
  type UserStats,
  type QueryHistoryItem,
} from "@/lib/api/apiKeys";

const TOOL_ICONS: Record<string, typeof Search> = {
  search: Search,
  answer: Zap,
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

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
            <Zap className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">BrowseAI.dev</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-accent" />
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <Badge variant="outline" className="text-xs">Free</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History className="w-4 h-4" />
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Settings className="w-4 h-4" />
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-4 h-4 text-accent" />
                  Query History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {history.map((item) => {
                    const Icon = TOOL_ICONS[item.tool] || Zap;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{item.query}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {item.tool}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <ApiKeyManager />

          <Card className="border-amber-400/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-amber-400">&#9733;</span>
                BrowseAI Dev Pro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Coming soon — unlock advanced features for power users and teams.</p>
              <ul className="text-sm space-y-2 text-muted-foreground mb-4">
                <li>Higher rate limits and priority processing</li>
                <li>Team API keys and shared usage dashboards</li>
                <li>Advanced analytics and query insights</li>
                <li>Webhook notifications and API callbacks</li>
                <li>Priority support</li>
              </ul>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
