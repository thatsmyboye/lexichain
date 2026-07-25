import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Suspense, lazy } from "react";
import Index from "./pages/Index";

// Import new providers
import { SoundProvider } from "@/components/effects/SoundSystem";
import { ColorBlindProvider } from "@/components/accessibility/ColorBlindSupport";
import { ARIAProvider } from "@/components/accessibility/ARIAComponents";
import { ComponentPreloader, PerformanceMetrics } from "@/components/performance/CodeSplitting";

// Lazy load non-critical pages using optimized components
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const MyAccountPage = lazy(() => import("./pages/MyAccountPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const DebugPage = lazy(() => import("./pages/DebugPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LoadingSpinner = () => <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
  </div>;
const queryClient = new QueryClient();
const App = () => <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <SoundProvider>
      <ColorBlindProvider>
        <ARIAProvider>
          <TooltipProvider>
            <ComponentPreloader>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/stats" element={<StatsPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/account" element={<MyAccountPage />} />
                    <Route path="/debug" element={<DebugPage />} />
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
              
            </ComponentPreloader>
          </TooltipProvider>
        </ARIAProvider>
      </ColorBlindProvider>
    </SoundProvider>
    </ThemeProvider>
  </QueryClientProvider>;
export default App;