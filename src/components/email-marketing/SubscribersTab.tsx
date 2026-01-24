import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Users, 
  Mail, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  UserCheck,
  UserX
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAGE_SIZE = 50;

export function SubscribersTab() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Fetch total count
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["all-subscribers-count", tenantId, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      let query = supabase
        .from("email_marketing_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      
      if (debouncedSearch) {
        query = query.or(`email.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`);
      }
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tenantId,
  });

  // Fetch paginated subscribers
  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["all-subscribers", tenantId, currentPage, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      let query = supabase
        .from("email_marketing_subscribers")
        .select("id, email, name, phone, status, source, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (debouncedSearch) {
        query = query.or(`email.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`);
      }
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["all-subscribers-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return { active: 0, unsubscribed: 0, total: 0 };
      
      const { count: activeCount } = await supabase
        .from("email_marketing_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      const { count: unsubscribedCount } = await supabase
        .from("email_marketing_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "unsubscribed");
      
      const { count: totalCount } = await supabase
        .from("email_marketing_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      
      return { 
        active: activeCount || 0, 
        unsubscribed: unsubscribedCount || 0, 
        total: totalCount || 0 
      };
    },
    enabled: !!tenantId,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total?.toLocaleString("pt-BR") || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.active?.toLocaleString("pt-BR") || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Descadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats?.unsubscribed?.toLocaleString("pt-BR") || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Página</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPage}</div>
            <p className="text-sm text-muted-foreground">de {totalPages || 1}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="unsubscribed">Descadastrados</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Todos os Assinantes ({totalCount.toLocaleString("pt-BR")})
            </CardTitle>
            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                Exibindo {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount.toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : subscribers.length === 0 ? (
            <EmptyState 
              icon={Users} 
              title="Nenhum assinante" 
              description={debouncedSearch || statusFilter !== "all" 
                ? "Nenhum assinante encontrado com esses filtros"
                : "Assinantes capturados via formulários aparecerão aqui"
              } 
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assinante</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Inscrito em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Mail className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{sub.name || "Sem nome"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sub.email}</TableCell>
                        <TableCell>
                          {sub.source && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {sub.source.includes("tag_sync") ? "Tag Sync" : sub.source}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={sub.status === "active" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {sub.status === "active"
                              ? "Ativo"
                              : sub.status === "unsubscribed"
                              ? "Descadastrado"
                              : sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
