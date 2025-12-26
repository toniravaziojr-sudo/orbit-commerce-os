import { PageHeader } from "@/components/ui/page-header";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { SystemEmailTemplates } from "@/components/integrations/SystemEmailTemplates";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Mail } from "lucide-react";

// Only this email can access this page
const PLATFORM_ADMIN_EMAIL = "respeiteohomem@gmail.com";

export default function SystemEmails() {
  const { user, session } = useAuth();
  const loading = session === undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect non-admin users
  if (!user || user.email !== PLATFORM_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Emails do App"
        description="Configure o remetente e personalize os templates de emails do sistema"
      />

      <div className="space-y-6">
        {/* Email Configuration */}
        <SystemEmailSettings />

        {/* Email Templates */}
        <SystemEmailTemplates />
      </div>
    </div>
  );
}
