import { ShoppingBag, Plus, Truck, Package, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Purchases() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Compras"
        description="Controle de fornecedores, pedidos de compra e recebimentos"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Compra
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Pedidos Pendentes"
          value="0"
          icon={ShoppingBag}
          variant="warning"
        />
        <StatCard
          title="Em Trânsito"
          value="0"
          icon={Truck}
          variant="info"
        />
        <StatCard
          title="Recebidos (Mês)"
          value="0"
          icon={Package}
          variant="success"
        />
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Users className="h-4 w-4" />
            Fornecedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Pedidos de Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ShoppingBag}
                title="Nenhum pedido de compra"
                description="Registre pedidos de compra para controlar o reabastecimento do seu estoque."
                action={{
                  label: "Criar Pedido",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Users}
                title="Nenhum fornecedor cadastrado"
                description="Cadastre seus fornecedores para organizar pedidos de compra e histórico."
                action={{
                  label: "Adicionar Fornecedor",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
