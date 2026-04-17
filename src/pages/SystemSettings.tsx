// =============================================
// SYSTEM SETTINGS — /system/settings
// Casa oficial das configurações da loja. Hoje hospeda:
//   - Pagamentos (gateways e métodos)
//   - Fiscal (atalho que abre a página dedicada /fiscal/configuracoes
//             marcando ?from=settings para o botão Voltar saber retornar para cá)
// =============================================
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CreditCard, FileText } from 'lucide-react';
import { PaymentSettingsTab } from '@/components/system-settings/PaymentSettingsTab';

export default function SystemSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'payments');

  // Quando a URL chega com ?tab=fiscal, redirecionamos para a página dedicada
  // mantendo a marcação de origem para o botão Voltar funcionar de forma contextual.
  useEffect(() => {
    if (tabFromUrl === 'fiscal') {
      navigate('/fiscal/configuracoes?from=settings', { replace: true });
    }
  }, [tabFromUrl, navigate]);

  const handleTabChange = (value: string) => {
    if (value === 'fiscal') {
      navigate('/fiscal/configuracoes?from=settings');
      return;
    }
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Configurações do Sistema"
        description="Configure pagamentos, regras operacionais e parâmetros globais da loja"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-auto inline-flex">
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Fiscal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-6">
          <PaymentSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
