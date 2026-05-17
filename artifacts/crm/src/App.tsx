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
import ContactEdit from "@/pages/contacts/edit";
import Pipelines from "@/pages/pipelines/index";
import CalendarSync from "@/pages/calendar/sync";
import Salespeople from "@/pages/salespeople/index";
import Products from "@/pages/products/index";
import Imports from "@/pages/imports/index";
import CsvPage from "@/pages/csv/index";
import Gmail from "@/pages/gmail/index";
import Prompts from "@/pages/prompts/index";
import UsersPage from "@/pages/users/index";
import Followups from "@/pages/followups/index";
import GoalsPage from "@/pages/goals/index";
import InboxComercial from "@/pages/inbox/index";
import AnuraPage from "@/pages/anura/index";
import PriceLists from "@/pages/price-lists/index";
import Quotes from "@/pages/quotes/index";
import QuoteEdit from "@/pages/quotes/edit";
import Orders from "@/pages/orders/index";
import OrderEdit from "@/pages/orders/edit";
import Tasks from "@/pages/tasks/index";
import CalendarPage from "@/pages/calendar/index";
import EmailTemplates from "@/pages/email-templates/index";
import Reports from "@/pages/reports/index";
import Automation from "@/pages/automation/index";
import CustomFields from "@/pages/custom-fields/index";
import NotFound from "@/pages/not-found";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ErrorBoundary } from "@/components/error-boundary";
import AuditLogPage from "@/pages/audit/index";
import ProductionList from "@/pages/production/index";
import ProductionDetail from "@/pages/production/detail";
import ProductionDashboard from "@/pages/production/dashboard";

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

      <Route path="/inbox" component={() => <ProtectedRoute component={InboxComercial} />} />

      <Route path="/emails" component={() => <ProtectedRoute component={Emails} />} />
      <Route path="/emails/:id" component={() => <ProtectedRoute component={EmailDetail} />} />

      <Route path="/opportunities" component={() => <ProtectedRoute component={Opportunities} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/contacts" component={() => <ProtectedRoute component={Contacts} />} />
      <Route path="/contacts/new" component={() => <ProtectedRoute component={ContactEdit} />} />
      <Route path="/contacts/:id" component={() => <ProtectedRoute component={ContactEdit} />} />
      <Route path="/pipelines" component={() => <ProtectedRoute component={Pipelines} />} />
      <Route path="/calendar/sync" component={() => <ProtectedRoute component={CalendarSync} />} />
      <Route path="/salespeople" component={() => <ProtectedRoute component={Salespeople} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/imports" component={() => <ProtectedRoute component={Imports} />} />
      <Route path="/csv" component={() => <ProtectedRoute component={CsvPage} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditLogPage} />} />
      <Route path="/production" component={() => <ProtectedRoute component={ProductionList} />} />
      <Route path="/production/dashboard" component={() => <ProtectedRoute component={ProductionDashboard} />} />
      <Route path="/production/:id" component={() => <ProtectedRoute component={ProductionDetail} />} />
      <Route path="/gmail" component={() => <ProtectedRoute component={Gmail} />} />
      <Route path="/anura" component={() => <ProtectedRoute component={AnuraPage} />} />
      <Route path="/followups" component={() => <ProtectedRoute component={Followups} />} />
      <Route path="/goals" component={() => <ProtectedRoute component={GoalsPage} />} />
      <Route path="/prompts" component={() => <ProtectedRoute component={Prompts} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />

      <Route path="/price-lists" component={() => <ProtectedRoute component={PriceLists} />} />
      <Route path="/quotes" component={() => <ProtectedRoute component={Quotes} />} />
      <Route path="/quotes/new" component={() => <ProtectedRoute component={QuoteEdit} />} />
      <Route path="/quotes/:id" component={() => <ProtectedRoute component={QuoteEdit} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/orders/new" component={() => <ProtectedRoute component={OrderEdit} />} />
      <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderEdit} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
      <Route path="/calendar" component={() => <ProtectedRoute component={CalendarPage} />} />
      <Route path="/email-templates" component={() => <ProtectedRoute component={EmailTemplates} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/automation" component={() => <ProtectedRoute component={Automation} />} />
      <Route path="/custom-fields" component={() => <ProtectedRoute component={CustomFields} />} />

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
            <ErrorBoundary>
              <Router />
              <CommandPalette />
              <KeyboardShortcuts />
            </ErrorBoundary>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
