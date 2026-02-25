import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle,
  ShoppingBag,
  Package,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { MeliOrdersTab } from "@/components/marketplaces/MeliOrdersTab";
import { MeliListingsTab } from "@/components/marketplaces/MeliListingsTab";
import { MeliMetricsTab } from "@/components/marketplaces/MeliMetricsTab";
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
  
  const defaultTab = searchParams.get("tab") || (isConnected ? "pedidos" : "pedidos");
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Redirect to integrations if not connected (connection must happen there)
  useEffect(() => {
    if (!isLoading && !isConnected) {
      navigate("/integrations?tab=marketplaces", { replace: true });
    }
  }, [isConnected, isLoading, navigate]);

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
          <TabsTrigger value="pedidos" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="gap-2">
            <Package className="h-4 w-4" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-6">
          <MeliOrdersTab />
        </TabsContent>

        <TabsContent value="anuncios" className="mt-6">
          <MeliListingsTab />
        </TabsContent>

        <TabsContent value="metricas" className="mt-6">
          <MeliMetricsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}