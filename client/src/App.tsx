import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";

import { ProtectedRoute } from "@/lib/protected-route";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminCalendarPage from "@/pages/admin-calendar-page";
import EditNeedPage from "@/pages/edit-need-page";
import FulfillPage from "@/pages/fulfill-page";
import NeedPage from "@/pages/need-page";
import PledgePage from "@/pages/pledge-page";
import EventSignupManagePage from "@/pages/event-signup-manage-page";
import {
  EmbeddedCalendarPage,
  StandaloneCalendarPage,
} from "@/pages/public-calendar-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/calendar" component={StandaloneCalendarPage} />
      <Route path="/embed" component={EmbeddedCalendarPage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/admin/needs/:id/edit" component={EditNeedPage} />
      <ProtectedRoute path="/admin/calendar" component={AdminCalendarPage} />
      <ProtectedRoute path="/admin/events" component={AdminDashboard} />
      <ProtectedRoute path="/admin/needs" component={AdminDashboard} />
      <ProtectedRoute path="/admin/drafts" component={AdminDashboard} />
      <ProtectedRoute path="/admin/new" component={AdminDashboard} />
      <ProtectedRoute path="/admin/reports" component={AdminDashboard} />
      <ProtectedRoute path="/admin/settings" component={AdminDashboard} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <Route path="/fulfill" component={FulfillPage} />
      <Route path="/signup/manage" component={EventSignupManagePage} />
      <Route path="/pledge/:id" component={PledgePage} />
      <Route path="/need/:id" component={NeedPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
