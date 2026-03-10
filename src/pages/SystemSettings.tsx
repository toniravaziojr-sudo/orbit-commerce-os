import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CreditCard } from 'lucide-react';
import { PaymentSettingsTab } from '@/components/system-settings/PaymentSettingsTab';

export default function SystemSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'payments');

  const handleTabChange = (value: string) => {
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
        </TabsList>

        <TabsContent value="payments" className="mt-6">
          <PaymentSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
