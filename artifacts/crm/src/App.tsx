import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Emails from "@/pages/emails/index";
import EmailDetail from "@/pages/emails/detail";
import Opportunities from "@/pages/opportunities/index";
import Clients from "@/pages/clients/index";
import Contacts from "@/pages/contacts/index";
import Salespeople from "@/pages/salespeople/index";
import Products from "@/pages/products/index";
import Imports from "@/pages/imports/index";
import Gmail from "@/pages/gmail/index";
import Prompts from "@/pages/prompts/index";
import UsersPage from "@/pages/users/index";
import Followups from "@/pages/followups/index";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: any }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
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
      <Route path="/contacts" component={() => <ProtectedRoute component={Contacts} />} />
      <Route path="/salespeople" component={() => <ProtectedRoute component={Salespeople} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/imports" component={() => <ProtectedRoute component={Imports} />} />
      <Route path="/gmail" component={() => <ProtectedRoute component={Gmail} />} />
      <Route path="/followups" component={() => <ProtectedRoute component={Followups} />} />
      <Route path="/prompts" component={() => <ProtectedRoute component={Prompts} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />

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
