import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { AdminErrorBoundary } from "./AdminErrorBoundary";
import { MFAEnrollmentBanner } from "@/components/auth/MFAEnrollmentBanner";
import { PlatformCostsAlertBanner } from "@/components/platform/PlatformCostsAlertBanner";

export function AppShell() {
  const location = useLocation();
  const isPlatformRoute = location.pathname.startsWith("/platform");

  useEffect(() => {
    document.title = 'Comando Central';
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      rootOverflow: root?.style.overflow ?? '',
      rootHeight: root?.style.height ?? '',
    };

    html.style.overflow = 'hidden';
    html.style.height = '100dvh';
    body.style.overflow = 'hidden';
    body.style.height = '100dvh';

    if (root) {
      root.style.overflow = 'hidden';
      root.style.height = '100dvh';
    }

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;

      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.height = previous.rootHeight;
      }
    };
  }, []);

  return (
    <AdminModeProvider>
      <AdminErrorBoundary>
        <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AppHeader />
            {isPlatformRoute && <PlatformCostsAlertBanner />}
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