import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FiscalInvoiceList } from '@/components/fiscal/FiscalInvoiceList';
import { FiscalSettingsContent } from '@/components/fiscal/FiscalSettingsContent';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MainTab = 'pedidos' | 'notas';

export default function Fiscal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MainTab | null;
  const rawTab = searchParams.get('tab');
  const showSettings = rawTab === 'configuracoes';
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(
    tabFromUrl === 'pedidos' || tabFromUrl === 'notas' ? tabFromUrl : 'pedidos'
  );
  const [settingsOpen, setSettingsOpen] = useState(showSettings);

  useEffect(() => {
    if (rawTab === 'configuracoes') {
      setSettingsOpen(true);
    } else if (tabFromUrl === 'pedidos' || tabFromUrl === 'notas') {
      setActiveMainTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveMainTab(tab as MainTab);
    setSearchParams({ tab });
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  const handleCloseSettings = (open: boolean) => {
    setSettingsOpen(open);
    if (!open && searchParams.get('tab') === 'configuracoes') {
      setSearchParams({ tab: activeMainTab });
    }
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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={handleCloseSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações Fiscais</DialogTitle>
          </DialogHeader>
          <FiscalSettingsContent />
        </DialogContent>
      </Dialog>
    </div>
  );
}
