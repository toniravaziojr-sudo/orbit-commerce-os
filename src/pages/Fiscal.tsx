import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowUpRight, ArrowDownLeft, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiscalInvoiceList } from '@/components/fiscal/FiscalInvoiceList';
import { FiscalSettingsContent } from '@/components/fiscal/FiscalSettingsContent';

type MainTab = 'saida' | 'entrada' | 'configuracoes';

export default function Fiscal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MainTab | null;
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(tabFromUrl || 'saida');

  // Sync URL with tab
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeMainTab) {
      setActiveMainTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveMainTab(tab as MainTab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Gestão de notas fiscais eletrônicas (NF-e)"
      />

      <Tabs value={activeMainTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="saida" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            NFs Saída
          </TabsTrigger>
          <TabsTrigger value="entrada" className="gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            NFs Entrada
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saida" className="space-y-6">
          <FiscalInvoiceList tipoDocumento={1} />
        </TabsContent>

        <TabsContent value="entrada" className="space-y-6">
          <FiscalInvoiceList tipoDocumento={0} />
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-6">
          <FiscalSettingsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
