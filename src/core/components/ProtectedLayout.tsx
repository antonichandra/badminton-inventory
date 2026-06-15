import { useState } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BusinessProvider } from "../context/BusinessContext";
import { useBusinessGuard } from "../hooks/useBusinessGuard";
import { useNavigationLayout } from "../hooks/useNavigationLayout";
import { useRequireAuth } from "../hooks/useRequireAuth";

export function ProtectedLayout() {
  const { isLoading: authLoading } = useRequireAuth("approved");
  const { isLoading: businessGuardLoading } = useBusinessGuard();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const layout = useNavigationLayout();
  const useBottomNav = layout === "bottom";

  if (authLoading || businessGuardLoading) {
    return <LoadingScreen />;
  }

  return (
    <BusinessProvider>
      <div className="flex h-svh min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {!useBottomNav && (
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            showMenuButton={!useBottomNav}
            onMenuOpen={() => setSidebarOpen(true)}
          />
          <main
            className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${
              useBottomNav ? "pb-[var(--bottom-nav-total)]" : ""
            }`}
          >
            <div className="page-content mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
        {useBottomNav && <BottomNav />}
      </div>
    </BusinessProvider>
  );
}
