import { FileText, Plus, AlertTriangle, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Fiscal() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Emissão de notas fiscais e integrações fiscais"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Emitir NF-e
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="NF-e Emitidas (Mês)"
          value="0"
          icon={FileText}
          variant="primary"
        />
        <StatCard
          title="Autorizadas"
          value="0"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pendentes"
          value="0"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Canceladas"
          value="0"
          icon={FileText}
          variant="destructive"
        />
      </div>

      {/* NF-e List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Notas Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FileText}
            title="Nenhuma nota fiscal emitida"
            description="Configure sua integração fiscal para emitir NF-e automaticamente quando pedidos forem confirmados."
            action={{
              label: "Configurar Integração",
              onClick: () => {},
            }}
          />
        </CardContent>
      </Card>

      {/* Integration Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                Integração Fiscal
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte com seu sistema de emissão de NF-e para automatizar todo
                o processo fiscal.
              </p>
            </div>
            <Button variant="outline">Configurar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
