import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FiscalInvoiceList } from '@/components/fiscal/FiscalInvoiceList';

type MainTab = 'pedidos' | 'notas';

export default function Fiscal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MainTab | null;
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(
    tabFromUrl === 'pedidos' || tabFromUrl === 'notas' ? tabFromUrl : 'pedidos'
  );

  // Compat: rota legada `?tab=configuracoes` redireciona para a nova página dedicada.
  useEffect(() => {
    if (tabFromUrl === 'configuracoes' as any) {
      navigate('/fiscal/configuracoes', { replace: true });
      return;
    }
    if (tabFromUrl === 'pedidos' || tabFromUrl === 'notas') {
      setActiveMainTab(tabFromUrl);
    }
  }, [tabFromUrl, navigate]);

  const handleTabChange = (tab: string) => {
    setActiveMainTab(tab as MainTab);
    setSearchParams({ tab });
  };

  const handleOpenSettings = () => {
    navigate('/fiscal/configuracoes');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Gestão de notas fiscais eletrônicas (NF-e)"
        actions={
          <Button variant="outline" onClick={handleOpenSettings} className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </Button>
        }
      />

      <Tabs value={activeMainTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pedidos" className="gap-2">
            <FileText className="h-4 w-4" />
            Pedidos em Aberto
          </TabsTrigger>
          <TabsTrigger value="notas" className="gap-2">
            <Receipt className="h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="space-y-6">
          <FiscalInvoiceList mode="orders" />
        </TabsContent>

        <TabsContent value="notas" className="space-y-6">
          <FiscalInvoiceList mode="invoices" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
