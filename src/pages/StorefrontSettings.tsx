import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, LayoutTemplate, Settings, Palette } from 'lucide-react';
import { getPublicHomeUrl } from '@/lib/publicUrls';
import { StorefrontTemplatesTab } from '@/components/storefront-admin/StorefrontTemplatesTab';
import { StorefrontConfigTab } from '@/components/storefront-admin/StorefrontConfigTab';

export default function StorefrontSettings() {
  const { currentTenant } = useAuth();
  const { settings, isLoading } = useStoreSettings();

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
        description="Gerencie templates e configurações da sua loja"
        actions={
          <div className="flex gap-2">
            <Link to="/storefront/builder?edit=home">
              <Button variant="outline">
                <Palette className="mr-2 h-4 w-4" />
                Abrir Editor
              </Button>
            </Link>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </a>
          </div>
        }
      />

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
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
