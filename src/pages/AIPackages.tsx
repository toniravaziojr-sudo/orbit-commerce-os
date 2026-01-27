import { useState } from "react";
import { Package, Sparkles, TrendingUp, History, Info, CreditCard, AlertTriangle, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useCreditPackages, useCreditWallet, useCreditLedger, CreditPackage, formatPrice } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/ai-packages/CreditBalance";
import { CreditPackageCard } from "@/components/ai-packages/CreditPackageCard";
import { CreditLedgerTable } from "@/components/ai-packages/CreditLedgerTable";
import { AIPricingTable } from "@/components/ai-packages/AIPricingTable";
import { toast } from "sonner";

export default function AIPackages() {
  const { isPlatformOperator } = usePlatformOperator();
  const [activeTab, setActiveTab] = useState("credits");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const { data: packages, isLoading: loadingPackages } = useCreditPackages();
  const { data: wallet, isLoading: loadingWallet } = useCreditWallet();
  const { data: ledger, isLoading: loadingLedger } = useCreditLedger(100);

  const handlePurchase = async (pkg: CreditPackage) => {
    setPurchasingId(pkg.id);
    try {
      // TODO: Integrate with payment gateway (Mercado Pago)
      toast.info("Funcionalidade de pagamento em desenvolvimento", {
        description: `Pacote: ${pkg.name} - ${formatPrice(pkg.price_cents)}`,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error("Erro ao processar compra");
    } finally {
      setPurchasingId(null);
    }
  };

  // Find popular package (15K is usually the best value)
  const popularSku = 'CC_CREDITS_15K';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Pacotes IA"
        description="Gerencie seus créditos de inteligência artificial"
        actions={
          isPlatformOperator ? (
            <Button>
              <Package className="h-4 w-4 mr-2" />
              Gerenciar Pacotes
            </Button>
          ) : null
        }
      />

      {/* Payment Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Informações sobre pagamento</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Todos os pacotes requerem <strong>cartão de crédito</strong>. Os custos de uso de IA 
            podem variar conforme o consumo real. Consulte a aba "Tabela de Preços" para detalhes.
          </p>
          <p className="text-sm">
            Não tem cartão de crédito?{" "}
            <a href="mailto:contato@comandocentral.com.br" className="text-primary hover:underline inline-flex items-center gap-1">
              Fale conosco <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="credits" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Créditos
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Consumo
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <Info className="h-4 w-4" />
            Tabela de Preços
          </TabsTrigger>
        </TabsList>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Balance Card */}
            <div className="lg:col-span-1">
              <CreditBalance />
            </div>

            {/* Packages Grid */}
            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Pacotes Disponíveis</h3>
              {loadingPackages ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="h-24 bg-muted" />
                      <CardContent className="h-32 bg-muted/50" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {packages?.map((pkg) => (
                    <CreditPackageCard
                      key={pkg.id}
                      package={pkg}
                      isPopular={pkg.sku === popularSku}
                      onPurchase={handlePurchase}
                      isPurchasing={purchasingId === pkg.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Consumo de Créditos</CardTitle>
              <CardDescription>
                Acompanhe o uso de IA da sua loja em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLedger ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : ledger && ledger.filter(e => e.transaction_type === 'consume').length > 0 ? (
                <CreditLedgerTable 
                  entries={ledger.filter(e => e.transaction_type === 'consume').slice(0, 20)} 
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum consumo registrado</p>
                  <p className="text-sm">Compre créditos e comece a usar as funcionalidades de IA</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>
                Todas as movimentações de créditos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditLedgerTable entries={ledger || []} isLoading={loadingLedger} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Tabela de Preços por Funcionalidade
              </CardTitle>
              <CardDescription>
                Valores estimados de consumo de créditos por operação de IA.
                O custo real pode variar conforme o tamanho do conteúdo processado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIPricingTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
