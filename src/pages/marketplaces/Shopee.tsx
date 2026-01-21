import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle,
  Link2,
  ShoppingBag,
  MessageSquare,
  Package,
  Construction,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ShopeeConnectionCard, ShopeeLogo } from "@/components/marketplaces/ShopeeConnectionCard";
import { ShopeeOrdersTab } from "@/components/marketplaces/ShopeeOrdersTab";
import { useShopeeConnection } from "@/hooks/useShopeeConnection";

export default function Shopee() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, isLoading, platformConfigured } = useShopeeConnection();
  
  const defaultTab = searchParams.get("tab") || (isConnected ? "pedidos" : "conexao");
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Redirecionar para pedidos quando conectar
  useEffect(() => {
    if (isConnected && activeTab === "conexao") {
      setActiveTab("pedidos");
    }
  }, [isConnected]);

  // Processar callback do OAuth
  useEffect(() => {
    const shopeeConnected = searchParams.get("shopee_connected");
    const shopeeError = searchParams.get("shopee_error");

    if (shopeeConnected === "true") {
      toast.success("Shopee conectada com sucesso!", {
        description: "Seus pedidos e mensagens serão sincronizados automaticamente.",
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      });
      // Limpar params
      searchParams.delete("shopee_connected");
      setSearchParams(searchParams);
    }

    if (shopeeError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parâmetros ausentes na resposta da Shopee",
        invalid_state: "Estado inválido. Tente novamente.",
        not_configured: "Integração não configurada. Contate o administrador.",
        token_exchange_failed: "Falha ao obter token. Tente novamente.",
        save_failed: "Erro ao salvar conexão. Tente novamente.",
        internal_error: "Erro interno. Tente novamente.",
        access_denied: "Acesso negado pela Shopee",
      };

      toast.error("Erro ao conectar Shopee", {
        description: errorMessages[shopeeError] || shopeeError,
        icon: <XCircle className="h-4 w-4 text-red-500" />,
      });

      // Limpar params
      searchParams.delete("shopee_error");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShopeeLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Shopee
              {isConnected && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie sua integração com a Shopee
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
          <TabsTrigger value="anuncios" className="gap-2" disabled={!isConnected}>
            <Package className="h-4 w-4" />
            Anúncios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card de conexão */}
            <ShopeeConnectionCard />

            {/* Card de funcionalidades */}
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                      <ShoppingBag className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Pedidos</h4>
                      <p className="text-xs text-muted-foreground">
                        Receba pedidos automaticamente e processe-os junto com os da sua loja virtual
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">Atendimento</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Responda perguntas e mensagens pós-venda pelo módulo de atendimento unificado
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate("/support")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ir para Atendimento
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Package className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Anúncios</h4>
                      <p className="text-xs text-muted-foreground">
                        Crie e gerencie seus anúncios, sincronize estoque e preços
                      </p>
                      <Badge variant="secondary" className="mt-1 text-xs">Em breve</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pedidos" className="mt-6">
          <ShopeeOrdersTab />
        </TabsContent>

        <TabsContent value="anuncios" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Anúncios da Shopee
              </CardTitle>
              <CardDescription>
                Gerencie seus anúncios, estoque e preços
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                <Construction className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Em desenvolvimento:</strong> O gerenciamento de anúncios da Shopee está sendo implementado.
                  Em breve você poderá criar e editar anúncios diretamente por aqui.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
