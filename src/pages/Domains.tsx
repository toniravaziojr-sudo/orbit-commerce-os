import { PageHeader } from '@/components/ui/page-header';
import { DomainSettingsContent } from '@/components/settings/DomainSettingsContent';

/**
 * Standalone page for domain management.
 * This page is now primarily accessed via Integrations > Domínio/Email tab,
 * but remains available as a direct route for backwards compatibility.
 */
export default function Domains() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Domínios da Loja"
        description="Gerencie o domínio padrão e domínios personalizados da sua loja"
      />
      
      <DomainSettingsContent />
    </div>
  );
}