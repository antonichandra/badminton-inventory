import { useState } from "react";
import { Outlet } from "react-router-dom";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BusinessProvider } from "../context/BusinessContext";
import { useBusinessGuard } from "../hooks/useBusinessGuard";
import { useRequireAuth } from "../hooks/useRequireAuth";

export function ProtectedLayout() {
  const { isLoading: authLoading } = useRequireAuth("approved");
  const { isLoading: businessGuardLoading } = useBusinessGuard();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authLoading || businessGuardLoading) {
    return <LoadingScreen />;
  }

  return (
    <BusinessProvider>
      <div className="flex min-h-svh bg-slate-50 dark:bg-slate-950">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuOpen={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="page-content mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </BusinessProvider>
  );
}
