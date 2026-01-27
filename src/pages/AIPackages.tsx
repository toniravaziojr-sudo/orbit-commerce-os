import { useState } from "react";
import { Package, Sparkles, TrendingUp, CreditCard, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

// Placeholder data - will be replaced with real data from hooks
const mockPackages = [
  {
    id: "1",
    name: "Starter",
    description: "Ideal para começar com IA",
    credits: 1000,
    price_cents: 4900,
    features: ["Atendimento IA básico", "Geração de descrições"],
    is_popular: false,
  },
  {
    id: "2",
    name: "Pro",
    description: "Para lojas em crescimento",
    credits: 5000,
    price_cents: 14900,
    features: ["Atendimento IA avançado", "Geração de conteúdo", "Análise de dados"],
    is_popular: true,
  },
  {
    id: "3",
    name: "Enterprise",
    description: "Recursos ilimitados",
    credits: 20000,
    price_cents: 49900,
    features: ["Todos os recursos", "Suporte prioritário", "API dedicada"],
    is_popular: false,
  },
];

export default function AIPackages() {
  const { isPlatformAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("packages");

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Pacotes IA"
        description="Gerencie seus créditos de inteligência artificial"
        actions={
          isPlatformAdmin ? (
            <Button>
              <Package className="h-4 w-4 mr-2" />
              Novo Pacote
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="packages" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Pacotes
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Meu Uso
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-6">
          {/* Current Subscription Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Seu Pacote Atual
              </CardTitle>
              <CardDescription>
                Informações sobre sua assinatura de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">
                    Nenhum pacote contratado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolha um pacote abaixo para começar a usar IA
                  </p>
                </div>
                <Badge variant="secondary">Sem pacote</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Available Packages */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Pacotes Disponíveis</h3>
            <div className="grid gap-6 md:grid-cols-3">
              {mockPackages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={pkg.is_popular ? "border-primary ring-1 ring-primary" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{pkg.name}</CardTitle>
                      {pkg.is_popular && (
                        <Badge>Mais popular</Badge>
                      )}
                    </div>
                    <CardDescription>{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold">
                        {formatPrice(pkg.price_cents)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /mês
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pkg.credits.toLocaleString("pt-BR")} créditos
                      </p>
                    </div>
                    <ul className="space-y-2">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Sparkles className="h-3 w-3 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full" variant={pkg.is_popular ? "default" : "outline"}>
                      Contratar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Consumo de Créditos</CardTitle>
              <CardDescription>
                Acompanhe o uso de IA da sua loja
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum uso registrado</p>
                <p className="text-sm">Contrate um pacote para começar</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
              <CardDescription>
                Suas contratações e renovações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
