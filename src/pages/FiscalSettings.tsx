// =============================================
// FISCAL SETTINGS PAGE — /fiscal/configuracoes
// Página dedicada (não modal) com 3 abas:
//   1. Configurações Fiscais (Emitente)
//   2. Natureza Jurídica (Naturezas de Operação)
//   3. Outros (Inutilização, Automação, E-mail, Remessa, Desmembramento)
//
// Casa oficial: Sistema → Configurações → aba Fiscal.
// Atalho mantido: botão "Configurações" no módulo Fiscal.
//
// Botão "Voltar" CONTEXTUAL via query param ?from=:
//   - ?from=fiscal    -> volta para /fiscal?tab=pedidos
//   - ?from=settings  -> volta para /system/settings?tab=fiscal
//   - sem param       -> default = /system/settings?tab=fiscal (casa oficial)
// =============================================
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Scale, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmitenteSettings } from '@/components/fiscal/settings/EmitenteSettings';
import { OperationNaturesContent } from '@/components/fiscal/settings/OperationNaturesContent';
import { OutrosSettings } from '@/components/fiscal/settings/OutrosSettings';

type SettingsTab = 'emitente' | 'natureza' | 'outros';
type Origin = 'fiscal' | 'settings';

export default function FiscalSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('aba') as SettingsTab | null;
  const fromParam = searchParams.get('from') as Origin | null;
  const origin: Origin = fromParam === 'fiscal' ? 'fiscal' : 'settings';

  const activeTab: SettingsTab =
    tabFromUrl === 'natureza' || tabFromUrl === 'outros' ? tabFromUrl : 'emitente';

  const handleTabChange = (tab: string) => {
    // Preservar o ?from= ao trocar de aba
    const next = new URLSearchParams(searchParams);
    next.set('aba', tab);
    setSearchParams(next);
  };

  const handleBack = () => {
    if (origin === 'fiscal') {
      navigate('/fiscal?tab=pedidos');
    } else {
      navigate('/system/settings?tab=fiscal');
    }
  };

  const backLabel = origin === 'fiscal' ? 'Voltar para Fiscal' : 'Voltar para Configurações';

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Configurações Fiscais"
        description="Gerencie os dados fiscais, naturezas de operação e demais ajustes do módulo"
        actions={
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
    </div>
  );
}
