import { Users, Plus, Filter, Search, Download, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Customers() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Clientes"
        description="Base de clientes com histórico, tags e segmentação"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-3">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <Tag className="h-4 w-4" />
                Gerenciar Tags
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers List - Empty State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Base de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            description="Clientes serão adicionados automaticamente quando fizerem pedidos, ou você pode cadastrá-los manualmente."
            action={{
              label: "Adicionar Cliente",
              onClick: () => {},
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
