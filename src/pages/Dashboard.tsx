import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, LayoutDashboard, Activity, History, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

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
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
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
                <p className="text-3xl font-bold">0</p>
                <p className="text-xs text-muted-foreground mt-1">Usage tracking coming soon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Query History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">-</p>
                <p className="text-xs text-muted-foreground mt-1">History tracking coming soon</p>
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

          <Card className="border-amber-400/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-amber-400">&#9733;</span>
                BrowseAI Dev Pro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Coming soon — unlimited queries with hosted API keys.</p>
              <ul className="text-sm space-y-2 text-muted-foreground mb-4">
                <li>Unlimited queries (no 5/hour limit)</li>
                <li>Hosted API keys (no BYOK required)</li>
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
