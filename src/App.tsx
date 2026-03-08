import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Results from "./pages/Results";
import Compare from "./pages/Compare";
import Share from "./pages/Share";
import Playground from "./pages/Playground";
import Dashboard from "./pages/Dashboard";
import Developers from "./pages/Developers";
import Recipes from "./pages/Recipes";
import NotFound from "./pages/NotFound";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/results" element={<Results />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/share/:id" element={<Share />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
