import { useStoreSettings } from '@/hooks/useStoreSettings';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutTemplate, Settings } from 'lucide-react';
import { StorefrontTemplatesTab } from '@/components/storefront-admin/StorefrontTemplatesTab';
import { StorefrontConfigTab } from '@/components/storefront-admin/StorefrontConfigTab';

export default function StorefrontSettings() {
  const { isLoading } = useStoreSettings();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Loja Virtual"
        description="Gerencie templates e configurações da sua loja"
      />

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações da loja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <StorefrontTemplatesTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <StorefrontConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
