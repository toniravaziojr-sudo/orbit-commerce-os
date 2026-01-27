// =============================================
// B2B ENTITIES TAB - Lista de empresas salvas
// =============================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Search, Trash2, Users, Phone, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCnpj } from "@/lib/formatCnpj";

interface B2BEntity {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cidade: string;
  uf: string;
  cnae_descricao: string;
  telefone: string;
  email: string;
  has_email: boolean;
  has_phone: boolean;
  situacao_cadastral: string;
  created_at: string;
}

export default function B2BEntitiesTab() {
  const { currentTenant } = useAuth();
  const [entities, setEntities] = useState<B2BEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentTenant?.id) {
      loadEntities();
    }
  }, [currentTenant?.id]);

  const loadEntities = async () => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("b2b_entities")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setEntities(data || []);
    } catch (err: any) {
      console.error("Load entities error:", err);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Excluir ${ids.length} empresa(s)?`)) return;

    try {
      const { error } = await supabase
        .from("b2b_entities")
        .delete()
        .in("id", ids);

      if (error) throw error;

      setEntities((prev) => prev.filter((e) => !ids.includes(e.id)));
      setSelectedIds(new Set());
      toast.success(`${ids.length} empresa(s) excluída(s)`);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntities.map((e) => e.id)));
    }
  };

  const filteredEntities = entities.filter((e) => {
    const search = searchTerm.toLowerCase();
    return (
      e.razao_social?.toLowerCase().includes(search) ||
      e.nome_fantasia?.toLowerCase().includes(search) ||
      e.cnpj?.includes(search) ||
      e.cidade?.toLowerCase().includes(search) ||
      e.cnae_descricao?.toLowerCase().includes(search)
    );
  });

  // Stats
  const stats = {
    total: entities.length,
    withEmail: entities.filter((e) => e.has_email).length,
    withPhone: entities.filter((e) => e.has_phone).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Empresas Salvas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withEmail}</p>
                <p className="text-sm text-muted-foreground">Com E-mail</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withPhone}</p>
                <p className="text-sm text-muted-foreground">Com Telefone</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Empresas Salvas</CardTitle>
              <CardDescription>
                Gerencie sua base de prospecção B2B
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(Array.from(selectedIds))}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma empresa encontrada</p>
              <p className="text-sm">Use a aba "Buscar" para adicionar empresas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredEntities.length && filteredEntities.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(entity.id)}
                          onCheckedChange={() => toggleSelect(entity.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium line-clamp-1">
                            {entity.nome_fantasia || entity.razao_social}
                          </p>
                          {entity.cnae_descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {entity.cnae_descricao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCnpj(entity.cnpj)}
                      </TableCell>
                      <TableCell>
                        {entity.cidade && entity.uf ? (
                          <span>{entity.cidade} - {entity.uf}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entity.has_email && (
                            <Mail className="h-4 w-4 text-blue-600" />
                          )}
                          {entity.has_phone && (
                            <Phone className="h-4 w-4 text-green-600" />
                          )}
                          {!entity.has_email && !entity.has_phone && (
                            <span className="text-muted-foreground text-xs">Sem contato</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            entity.situacao_cadastral === "ATIVA"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }
                        >
                          {entity.situacao_cadastral || "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
