import { useState } from 'react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutTemplate, Settings, Zap, RefreshCw, Info } from 'lucide-react';
import { StorefrontTemplatesTab } from '@/components/storefront-admin/StorefrontTemplatesTab';
import { StorefrontConfigTab } from '@/components/storefront-admin/StorefrontConfigTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { cachePurge } from '@/lib/storefrontCachePurge';
import { toast } from 'sonner';

export default function StorefrontSettings() {
  const { isLoading } = useStoreSettings();
  const { currentTenant } = useAuth();
  const [isPurgingCache, setIsPurgingCache] = useState(false);

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

          {/* Cache Purge Card */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Limpar Cache da Loja
              </CardTitle>
              <CardDescription>
                Force a atualização do conteúdo público da sua loja
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                  <strong>Quando usar:</strong> Se você alterou produtos, menus ou configurações da loja e as mudanças 
                  não aparecem para os visitantes, use este botão para forçar a atualização imediata. 
                  Normalmente o cache é limpo automaticamente ao salvar no admin, mas em casos excepcionais 
                  pode ser necessário forçar manualmente.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!currentTenant?.id) return;
                  setIsPurgingCache(true);
                  try {
                    await cachePurge.full(currentTenant.id);
                    toast.success('Cache limpo com sucesso! As alterações aparecerão em instantes.');
                  } catch (err) {
                    toast.error('Falha ao limpar o cache. Tente novamente em alguns segundos.');
                  } finally {
                    setIsPurgingCache(false);
                  }
                }}
                disabled={isPurgingCache || !currentTenant?.id}
              >
                {isPurgingCache ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Limpando cache...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Purgar Cache Agora
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}