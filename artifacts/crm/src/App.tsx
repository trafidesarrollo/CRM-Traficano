import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ReactNode, useEffect } from "react";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Emails from "@/pages/emails/index";
import EmailDetail from "@/pages/emails/detail";
import Opportunities from "@/pages/opportunities/index";
import Clients from "@/pages/clients/index";
import Imports from "@/pages/imports/index";
import Gmail from "@/pages/gmail/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Minimal stubs for non-core pages to ensure completeness without hitting output limits
const PlaceholderPage = ({ title }: { title: string }) => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2">Módulo en construcción.</p>
    </div>
  );
};

function ProtectedRoute({ component: Component }: { component: any }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!user) return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      
      <Route path="/emails" component={() => <ProtectedRoute component={Emails} />} />
      <Route path="/emails/:id" component={() => <ProtectedRoute component={EmailDetail} />} />
      
      <Route path="/opportunities" component={() => <ProtectedRoute component={Opportunities} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/imports" component={() => <ProtectedRoute component={Imports} />} />
      <Route path="/gmail" component={() => <ProtectedRoute component={Gmail} />} />
      
      {/* Stubs for remaining routes to ensure full coverage implied by sidebar */}
      <Route path="/contacts" component={() => <ProtectedRoute component={() => {
        import("@/components/layout").then(m => m.AppLayout);
        const { AppLayout } = require("@/components/layout");
        return <AppLayout><PlaceholderPage title="Contactos" /></AppLayout>;
      }} />} />
      <Route path="/salespeople" component={() => <ProtectedRoute component={() => {
        const { AppLayout } = require("@/components/layout");
        return <AppLayout><PlaceholderPage title="Vendedores" /></AppLayout>;
      }} />} />
      <Route path="/products" component={() => <ProtectedRoute component={() => {
        const { AppLayout } = require("@/components/layout");
        return <AppLayout><PlaceholderPage title="Productos" /></AppLayout>;
      }} />} />
      <Route path="/prompts" component={() => <ProtectedRoute component={() => {
        const { AppLayout } = require("@/components/layout");
        return <AppLayout><PlaceholderPage title="Prompts IA" /></AppLayout>;
      }} />} />
      <Route path="/users" component={() => <ProtectedRoute component={() => {
        const { AppLayout } = require("@/components/layout");
        return <AppLayout><PlaceholderPage title="Gestión de Usuarios" /></AppLayout>;
      }} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
