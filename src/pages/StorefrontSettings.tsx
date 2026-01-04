import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, LayoutGrid, Settings } from 'lucide-react';
import { getPublicHomeUrl } from '@/lib/publicUrls';
import { StorefrontPagesTab } from '@/components/storefront-admin/StorefrontPagesTab';
import { StorefrontConfigTab } from '@/components/storefront-admin/StorefrontConfigTab';

export default function StorefrontSettings() {
  const { currentTenant } = useAuth();
  const { settings, isLoading, togglePublish } = useStoreSettings();

  const handleTogglePublish = async () => {
    await togglePublish.mutateAsync(!settings?.is_published);
  };

  const previewUrl = getPublicHomeUrl(currentTenant?.slug || '', true);

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
        description="Gerencie páginas e configurações da sua loja"
        actions={
          <div className="flex gap-2">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </a>
            <Button onClick={handleTogglePublish} variant={settings?.is_published ? 'destructive' : 'default'}>
              {settings?.is_published ? 'Despublicar' : 'Publicar Loja'}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="pages" className="w-full">
        <TabsList>
          <TabsTrigger value="pages" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Páginas
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-6">
          <StorefrontPagesTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <StorefrontConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
