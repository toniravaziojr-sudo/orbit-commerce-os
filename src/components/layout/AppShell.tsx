import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminModeProvider } from "@/contexts/AdminModeContext";

export function AppShell() {
  return (
    <AdminModeProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <AppHeader />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 scrollbar-thin">
            <div className="mx-auto max-w-[1600px]">
              <PermissionGuard>
                <Outlet />
              </PermissionGuard>
            </div>
          </main>
        </div>
      </div>
    </AdminModeProvider>
  );
}
