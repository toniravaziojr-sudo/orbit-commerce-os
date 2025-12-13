import { DollarSign, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Finance() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Financeiro"
        description="Controle de entradas, saídas, margens e conciliação"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita (Mês)"
          value="R$ 0,00"
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Despesas (Mês)"
          value="R$ 0,00"
          icon={TrendingDown}
          variant="destructive"
        />
        <StatCard
          title="Lucro Líquido"
          value="R$ 0,00"
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Margem Média"
          value="0%"
          icon={PiggyBank}
          variant="info"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Entradas
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <ArrowDownRight className="h-4 w-4" />
            Saídas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={DollarSign}
                title="Sem movimentações"
                description="Quando você tiver vendas e despesas, o resumo financeiro com gráficos e análises aparecerá aqui."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Entradas</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ArrowUpRight}
                title="Nenhuma entrada registrada"
                description="Receitas de vendas e outras entradas serão registradas automaticamente e manualmente aqui."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Saídas</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ArrowDownRight}
                title="Nenhuma saída registrada"
                description="Registre despesas operacionais, custos de produtos e outras saídas para análise de margem."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
