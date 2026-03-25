import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import CalendarPage from "@/pages/calendar";
import PostsPage from "@/pages/posts";
import AnalyticsPage from "@/pages/analytics";
import AccountsPage from "@/pages/accounts";
import SettingsPage from "@/pages/settings";
import BrandsPage from "@/pages/brands";
import SuggestionsPage from "@/pages/suggestions";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthProvider } from "@/hooks/use-auth.tsx";
import { ErrorBoundary } from "@/components/error-boundary";

function AuthedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/posts" component={PostsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/accounts" component={AccountsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/brands" component={BrandsPage} />
      <Route path="/suggestions" component={SuggestionsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthedAppLayout() {
  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "64px",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search posts, accounts..."
                  className="w-64 pl-9"
                  data-testid="input-global-search"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <AuthedRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route>
        <ProtectedRoute>
          <AuthedAppLayout />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary level="app">
        <AuthProvider>
          <TooltipProvider>
            <ErrorBoundary level="route">
              <AppRouter />
            </ErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
