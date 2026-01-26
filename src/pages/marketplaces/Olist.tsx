import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Link2,
  ShoppingBag,
  Package,
  Construction,
  ExternalLink,
  FileText,
  Boxes,
} from "lucide-react";
import { OlistConnectionCard, OlistLogo } from "@/components/marketplaces/OlistConnectionCard";
import { useOlistConnection } from "@/hooks/useOlistConnection";

export default function Olist() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, isLoading, connection } = useOlistConnection();
  
  const defaultTab = searchParams.get("tab") || (isConnected ? "pedidos" : "conexao");
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Redirect to pedidos when connected
  useEffect(() => {
    if (isConnected && activeTab === "conexao") {
      setActiveTab("pedidos");
    }
  }, [isConnected]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const accountTypeLabel = connection?.accountType === "erp" 
    ? "Olist ERP (Tiny)" 
    : connection?.accountType === "ecommerce" 
    ? "Olist E-commerce (Vnda)" 
    : "Olist";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OlistLogo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Olist
              {isConnected && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isConnected ? accountTypeLabel : "Integração com Olist ERP e E-commerce"}
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
          <TabsTrigger value="estoque" className="gap-2" disabled={!isConnected}>
            <Boxes className="h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="gap-2" disabled={!isConnected}>
            <FileText className="h-4 w-4" />
            Fiscal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Connection Card */}
            <OlistConnectionCard />

            {/* Features Card */}
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <ShoppingBag className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Pedidos</h4>
                      <p className="text-xs text-muted-foreground">
                        Sincronize pedidos automaticamente entre as plataformas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Boxes className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Estoque</h4>
                      <p className="text-xs text-muted-foreground">
                        Mantenha seu estoque sincronizado em tempo real
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Nota Fiscal</h4>
                      <p className="text-xs text-muted-foreground">
                        Emissão automática de NF-e e NFC-e via Olist ERP
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                      <Package className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Produtos</h4>
                      <p className="text-xs text-muted-foreground">
                        Sincronize produtos, preços e variações
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pedidos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Pedidos da Olist
              </CardTitle>
              <CardDescription>
                Visualize e gerencie pedidos sincronizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                <Construction className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Em desenvolvimento:</strong> A sincronização automática de pedidos está sendo implementada.
                  Em breve seus pedidos aparecerão aqui automaticamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estoque" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                Sincronização de Estoque
              </CardTitle>
              <CardDescription>
                Gerencie a sincronização de estoque entre plataformas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                <Construction className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Em desenvolvimento:</strong> A sincronização de estoque está sendo implementada.
                  Em breve você poderá manter seu estoque sincronizado em tempo real.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Integração Fiscal
              </CardTitle>
              <CardDescription>
                Emissão de notas fiscais via Olist ERP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connection?.accountType === "ecommerce" ? (
                <Alert>
                  <AlertDescription>
                    A integração fiscal está disponível apenas para contas <strong>Olist ERP (Tiny)</strong>.
                    Conecte uma conta ERP para usar essa funcionalidade.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                  <Construction className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Em desenvolvimento:</strong> A integração fiscal está sendo implementada.
                    Em breve você poderá emitir NF-e automaticamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
