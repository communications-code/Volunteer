import { useState } from "react";
import { useLocation } from "wouter";
import { LogIn, LogOut, Settings, Sparkles } from "lucide-react";

import NeedsTabs from "@/components/needs/needs-tabs";
import { LoginDialog } from "@/components/auth/login-dialog";
import { PublicShell } from "@/components/layout/public-shell";
import UpdatesSignupDialog from "@/components/layout/updates-signup-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const HomePage = () => {
  const [, navigate] = useLocation();
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      <PublicShell hideTopChrome activeTab="needs">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <Button onClick={() => setUpdatesOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Get Post Updates
          </Button>

          {user?.isAdmin ? (
            <>
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4" />
                Dashboard
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <LoginDialog trigger={<Button variant="outline"><LogIn className="h-4 w-4" />Admin</Button>} />
          )}
        </div>

        <NeedsTabs />
      </PublicShell>

      <UpdatesSignupDialog open={updatesOpen} onOpenChange={setUpdatesOpen} />
    </>
  );
};

export default HomePage;
