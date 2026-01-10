import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
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
import { MeliConnectionCard } from "@/components/marketplaces/MeliConnectionCard";
import { MeliOrdersTab } from "@/components/marketplaces/MeliOrdersTab";
import { useMeliConnection } from "@/hooks/useMeliConnection";

// Mercado Livre Logo Component
function MercadoLivreLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#FFE600"/>
      <path d="M24 8C15.163 8 8 15.163 8 24s7.163 16 16 16 16-7.163 16-16S32.837 8 24 8zm0 28c-6.627 0-12-5.373-12-12S17.373 12 24 12s12 5.373 12 12-5.373 12-12 12z" fill="#2D3277"/>
      <path d="M24 14c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 16c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" fill="#2D3277"/>
    </svg>
  );
}

export default function MercadoLivre() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, isLoading, platformConfigured } = useMeliConnection();
  
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
    const meliConnected = searchParams.get("meli_connected");
    const meliError = searchParams.get("meli_error");

    if (meliConnected === "true") {
      toast.success("Mercado Livre conectado com sucesso!", {
        description: "Seus pedidos e mensagens serão sincronizados automaticamente.",
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      });
      // Limpar params
      searchParams.delete("meli_connected");
      setSearchParams(searchParams);
    }

    if (meliError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parâmetros ausentes na resposta do Mercado Livre",
        invalid_state: "Estado inválido. Tente novamente.",
        not_configured: "Integração não configurada. Contate o administrador.",
        token_exchange_failed: "Falha ao obter token. Tente novamente.",
        save_failed: "Erro ao salvar conexão. Tente novamente.",
        internal_error: "Erro interno. Tente novamente.",
        access_denied: "Acesso negado pelo Mercado Livre",
      };

      toast.error("Erro ao conectar Mercado Livre", {
        description: errorMessages[meliError] || meliError,
        icon: <XCircle className="h-4 w-4 text-red-500" />,
      });

      // Limpar params
      searchParams.delete("meli_error");
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
          <MercadoLivreLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Mercado Livre
              {isConnected && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie sua integração com o Mercado Livre
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
            <MeliConnectionCard />

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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <ShoppingBag className="h-4 w-4 text-blue-600" />
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
          <MeliOrdersTab />
        </TabsContent>

        <TabsContent value="anuncios" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Anúncios do Mercado Livre
              </CardTitle>
              <CardDescription>
                Gerencie seus anúncios, estoque e preços
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                <Construction className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Em desenvolvimento:</strong> O gerenciamento de anúncios do Mercado Livre está sendo implementado.
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