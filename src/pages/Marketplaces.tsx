import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Construction, 
  ExternalLink, 
  ShoppingBag, 
  Store, 
  CheckCircle2, 
  XCircle,
  Info,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { MeliConnectionCard } from "@/components/marketplaces/MeliConnectionCard";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { IntegrationRequiredAlert } from "@/components/ui/integration-required-alert";

// Outros marketplaces (em breve)
const UPCOMING_MARKETPLACES = [
  {
    id: "shopee",
    name: "Shopee",
    description: "Alcance milhões de clientes no marketplace que mais cresce",
    logo: "🧡",
    url: "https://shopee.com.br",
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Venda globalmente com a maior loja online do mundo",
    logo: "📦",
    url: "https://www.amazon.com.br",
  },
  {
    id: "magalu",
    name: "Magazine Luiza",
    description: "Integre sua loja ao marketplace Magalu",
    logo: "💙",
    url: "https://www.magazineluiza.com.br",
  },
  {
    id: "shein",
    name: "Shein",
    description: "Alcance o público jovem no marketplace de moda",
    logo: "👗",
    url: "https://br.shein.com",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    description: "Venda para o mundo todo com o AliExpress",
    logo: "🌍",
    url: "https://www.aliexpress.com",
  },
  {
    id: "americanas",
    name: "Americanas",
    description: "Marketplace tradicional com grande alcance nacional",
    logo: "🔴",
    url: "https://www.americanas.com.br",
  },
];

export default function Marketplaces() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("mercadolivre");

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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Marketplaces"
        description="Conecte sua loja aos maiores marketplaces e gerencie tudo em um só lugar"
      />

      <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Conecte sua conta de vendedor para sincronizar pedidos, responder mensagens e gerenciar anúncios diretamente pelo sistema.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mercadolivre">Mercado Livre</TabsTrigger>
          <TabsTrigger value="outros">Outros Marketplaces</TabsTrigger>
        </TabsList>

        <TabsContent value="mercadolivre" className="mt-6">
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
                      <Store className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Atendimento</h4>
                      <p className="text-xs text-muted-foreground">
                        Responda perguntas e mensagens pós-venda pelo módulo de atendimento
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Construction className="h-4 w-4 text-purple-600" />
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

        <TabsContent value="outros" className="mt-6">
          <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 mb-6">
            <Construction className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Em desenvolvimento:</strong> Estamos trabalhando nas integrações com outros marketplaces. 
              Em breve você poderá conectar sua loja a mais canais de venda.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING_MARKETPLACES.map((marketplace) => (
              <Card key={marketplace.id} className="relative overflow-hidden opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                        {marketplace.logo}
                      </div>
                      <div>
                        <CardTitle className="text-base">{marketplace.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          Em breve
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-4 line-clamp-2">
                    {marketplace.description}
                  </CardDescription>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled 
                      className="flex-1"
                    >
                      <Store className="h-4 w-4 mr-2" />
                      Conectar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      asChild
                    >
                      <a href={marketplace.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-dashed mt-6">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Mais marketplaces em breve</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Estamos trabalhando para adicionar mais integrações. 
                Tem alguma sugestão? Entre em contato conosco!
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
