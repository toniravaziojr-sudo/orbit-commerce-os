import { PageHeader } from "@/components/ui/page-header";
import { SystemEmailSettings } from "@/components/integrations/SystemEmailSettings";
import { SystemEmailTemplates } from "@/components/integrations/SystemEmailTemplates";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { Navigate } from "react-router-dom";

export default function SystemEmails() {
  const { isPlatformOperator, isLoading } = usePlatformOperator();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect non-admin users
  if (!isPlatformOperator) {
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
