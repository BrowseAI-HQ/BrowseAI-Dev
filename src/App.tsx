import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { PendingForkRedirect } from "./components/PendingForkRedirect";

// Lazy-load all pages for route-based code splitting
const Index = lazy(() => import("./pages/Index"));
const Results = lazy(() => import("./pages/Results"));
const Compare = lazy(() => import("./pages/Compare"));
const Share = lazy(() => import("./pages/Share"));
const Playground = lazy(() => import("./pages/Playground"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Developers = lazy(() => import("./pages/Developers"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Docs = lazy(() => import("./pages/Docs"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Sessions = lazy(() => import("./pages/Sessions"));
const SharedSession = lazy(() => import("./pages/SharedSession"));
const Alternatives = lazy(() => import("./pages/Alternatives"));
const AlternativeDetail = lazy(() => import("./pages/AlternativeDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-black">
    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <PendingForkRedirect />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/results" element={<Results />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/share/:id" element={<Share />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/session/share/:shareId" element={<SharedSession />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/developers" element={<Developers />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/alternatives" element={<Alternatives />} />
              <Route path="/alternatives/:slug" element={<AlternativeDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
