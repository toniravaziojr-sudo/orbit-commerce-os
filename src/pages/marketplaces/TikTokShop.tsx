import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  Link2,
  ShoppingBag,
  Package,
  Truck,
  RotateCcw,
  ExternalLink,
  Settings,
  Loader2,
} from "lucide-react";
import { useTikTokShopConnection } from "@/hooks/useTikTokShopConnection";
import { TikTokShopCatalogTab } from "@/components/integrations/tiktok/TikTokShopCatalogTab";
import { TikTokShopOrdersTab } from "@/components/integrations/tiktok/TikTokShopOrdersTab";
import { TikTokShopFulfillmentTab } from "@/components/integrations/tiktok/TikTokShopFulfillmentTab";
import { TikTokShopReturnsTab } from "@/components/integrations/tiktok/TikTokShopReturnsTab";

function TikTokShopLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#000000"/>
      <path d="M33.6 18.4c-1.8 0-3.4-.7-4.6-1.8v8.2c0 4.2-3.4 7.6-7.6 7.6s-7.6-3.4-7.6-7.6 3.4-7.6 7.6-7.6c.4 0 .8 0 1.2.1v3.8c-.4-.1-.8-.2-1.2-.2-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.1 0 3.9-1.6 3.9-3.7V12h3.7c.3 2.5 2.2 4.5 4.6 4.9v1.5z" fill="#25F4EE"/>
      <path d="M34.6 19.4c-1.8 0-3.4-.7-4.6-1.8v8.2c0 4.2-3.4 7.6-7.6 7.6s-7.6-3.4-7.6-7.6 3.4-7.6 7.6-7.6c.4 0 .8 0 1.2.1v3.8c-.4-.1-.8-.2-1.2-.2-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.1 0 3.9-1.6 3.9-3.7V13h3.7c.3 2.5 2.2 4.5 4.6 4.9v1.5z" fill="#FE2C55"/>
    </svg>
  );
}

export default function TikTokShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { connectionStatus, isLoading } = useTikTokShopConnection();
  const isConnected = connectionStatus.isConnected;

  const tabFromUrl = searchParams.get("tab");
  const resolvedDefault = tabFromUrl || (isConnected ? "pedidos" : "conexao");
  const [activeTab, setActiveTab] = useState(resolvedDefault);

  useEffect(() => {
    if (!isLoading && !tabFromUrl) {
      setActiveTab(isConnected ? "pedidos" : "conexao");
    }
  }, [isLoading, isConnected, tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <TikTokShopLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TikTok Shop</h1>
            <p className="text-sm text-muted-foreground">Carregando status da integração...</p>
          </div>
        </div>
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TikTokShopLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              TikTok Shop
              {isConnected ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="secondary">Não conectado</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie sua integração com o TikTok Shop
              {connectionStatus.shopName && (
                <span className="ml-1">· {connectionStatus.shopName}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {!isConnected && (
            <TabsTrigger value="conexao" className="gap-2">
              <Link2 className="h-4 w-4" />
              Conexão
            </TabsTrigger>
          )}
          <TabsTrigger value="pedidos" className="gap-2" disabled={!isConnected}>
            <ShoppingBag className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-2" disabled={!isConnected}>
            <Package className="h-4 w-4" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="envios" className="gap-2" disabled={!isConnected}>
            <Truck className="h-4 w-4" />
            Envios
          </TabsTrigger>
          <TabsTrigger value="devolucoes" className="gap-2" disabled={!isConnected}>
            <RotateCcw className="h-4 w-4" />
            Devoluções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conectar TikTok Shop</CardTitle>
                <CardDescription>
                  Para conectar sua conta do TikTok Shop, acesse a área de Integrações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    A conexão com o TikTok Shop é gerenciada em <strong>Integrações → TikTok</strong>.
                    Clique no botão abaixo para ir até lá e conectar sua conta.
                  </AlertDescription>
                </Alert>
                <Button asChild>
                  <Link to="/integrations?tab=tiktok">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ir para Integrações
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">O que você pode fazer</CardTitle>
                <CardDescription>
                  Funcionalidades disponíveis com a integração
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900/30">
                      <ShoppingBag className="h-4 w-4 text-pink-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Pedidos</h4>
                      <p className="text-xs text-muted-foreground">
                        Receba e gerencie pedidos do TikTok Shop no seu painel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
                      <Package className="h-4 w-4 text-cyan-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Catálogo</h4>
                      <p className="text-xs text-muted-foreground">
                        Sincronize seu catálogo de produtos com o TikTok Shop
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Truck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Envios & Devoluções</h4>
                      <p className="text-xs text-muted-foreground">
                        Gerencie fulfillment, rastreamento e devoluções
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pedidos" className="mt-6">
          <TikTokShopOrdersTab />
        </TabsContent>

        <TabsContent value="catalogo" className="mt-6">
          <TikTokShopCatalogTab />
        </TabsContent>

        <TabsContent value="envios" className="mt-6">
          <TikTokShopFulfillmentTab />
        </TabsContent>

        <TabsContent value="devolucoes" className="mt-6">
          <TikTokShopReturnsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
