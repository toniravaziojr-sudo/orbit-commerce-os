import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { AdminErrorBoundary } from "./AdminErrorBoundary";
import { MFAEnrollmentBanner } from "@/components/auth/MFAEnrollmentBanner";

export function AppShell() {
  useEffect(() => {
    document.title = 'Comando Central';
  }, []);

  return (
    <AdminModeProvider>
      <AdminErrorBoundary>
        <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AppHeader />
            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 scrollbar-thin">
              <div className="mx-auto max-w-[1600px]">
                <PermissionGuard>
                  <MFAEnrollmentBanner />
                  <Outlet />
                </PermissionGuard>
              </div>
            </main>
          </div>
        </div>
      </AdminErrorBoundary>
    </AdminModeProvider>
  );
}