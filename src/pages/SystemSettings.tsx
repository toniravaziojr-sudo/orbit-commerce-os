// =============================================
// SYSTEM SETTINGS — /system/settings
// Casa oficial das configurações da loja. Hospeda:
//   - Pagamentos (gateways e métodos)
//   - Fiscal (conteúdo embutido — Emitente, Natureza Jurídica, Outros)
//
// A página dedicada `/fiscal/configuracoes` continua existindo e é acessada
// pelo botão "Configurações" do módulo Fiscal (`/fiscal`). Em ambas as
// superfícies o conteúdo é o MESMO (mesmos componentes), garantindo paridade.
// =============================================
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CreditCard, FileText, Building2, Scale, Settings2 } from 'lucide-react';
import { PaymentSettingsTab } from '@/components/system-settings/PaymentSettingsTab';
import { EmitenteSettings } from '@/components/fiscal/settings/EmitenteSettings';
import { OperationNaturesContent } from '@/components/fiscal/settings/OperationNaturesContent';
import { OutrosSettings } from '@/components/fiscal/settings/OutrosSettings';

type FiscalSubTab = 'emitente' | 'natureza' | 'outros';

export default function SystemSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const subFromUrl = searchParams.get('aba') as FiscalSubTab | null;

  const [activeTab, setActiveTab] = useState(tabFromUrl || 'payments');
  const activeFiscalSub: FiscalSubTab =
    subFromUrl === 'natureza' || subFromUrl === 'outros' ? subFromUrl : 'emitente';

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    if (value !== 'fiscal') next.delete('aba');
    setSearchParams(next);
  };

  const handleFiscalSubChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'fiscal');
    next.set('aba', value);
    setSearchParams(next);
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

        <TabsContent value="fiscal" className="mt-6 space-y-6">
          <Tabs value={activeFiscalSub} onValueChange={handleFiscalSubChange} className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="emitente" className="gap-2">
                <Building2 className="h-4 w-4" />
                Configurações Fiscais
              </TabsTrigger>
              <TabsTrigger value="natureza" className="gap-2">
                <Scale className="h-4 w-4" />
                Natureza Jurídica
              </TabsTrigger>
              <TabsTrigger value="outros" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Outros
              </TabsTrigger>
            </TabsList>

            <TabsContent value="emitente" className="space-y-6">
              <EmitenteSettings />
            </TabsContent>
            <TabsContent value="natureza" className="space-y-6">
              <OperationNaturesContent />
            </TabsContent>
            <TabsContent value="outros" className="space-y-6">
              <OutrosSettings />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
