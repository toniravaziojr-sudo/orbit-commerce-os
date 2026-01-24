import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Users, 
  Mail, 
  Tag, 
  Search, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertTriangle,
  UserCheck,
  UserX
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAGE_SIZE = 50;

export default function EmailMarketingListDetail() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  // Fetch list details
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["email-marketing-list", listId],
    queryFn: async () => {
      if (!listId) return null;
      const { data, error } = await supabase
        .from("email_marketing_lists")
        .select("*, customer_tags(id, name, color)")
        .eq("id", listId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!listId,
  });

  // Fetch subscribers count for this list
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["list-subscribers-count", listId, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!listId) return 0;
      
      // Subscribers are linked via source field containing list_id
      let query = supabase
        .from("email_marketing_subscribers")
        .select("id", { count: "exact", head: true })
        .like("source", `%${listId}%`);
      
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
    enabled: !!listId,
  });

  // Fetch paginated subscribers
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery({
    queryKey: ["list-subscribers", listId, currentPage, debouncedSearch, statusFilter],
    queryFn: async () => {
      if (!listId) return [];
      
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Subscribers are linked via source field containing list_id
      let query = supabase
        .from("email_marketing_subscribers")
        .select("id, email, name, phone, status, source, created_at, customer_id")
        .like("source", `%${listId}%`)
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
    enabled: !!listId,
  });

  // Stats - use separate count queries to bypass 1000 row limit
  const { data: stats } = useQuery({
    queryKey: ["list-subscribers-stats", listId],
    queryFn: async () => {
      if (!listId) return { active: 0, unsubscribed: 0, bounced: 0, total: 0 };
      
      // Run parallel count queries for each status
      const [activeResult, unsubscribedResult, bouncedResult] = await Promise.all([
        supabase
          .from("email_marketing_subscribers")
          .select("id", { count: "exact", head: true })
          .like("source", `%${listId}%`)
          .eq("status", "active"),
        supabase
          .from("email_marketing_subscribers")
          .select("id", { count: "exact", head: true })
          .like("source", `%${listId}%`)
          .eq("status", "unsubscribed"),
        supabase
          .from("email_marketing_subscribers")
          .select("id", { count: "exact", head: true })
          .like("source", `%${listId}%`)
          .eq("status", "bounced"),
      ]);
      
      const active = activeResult.count || 0;
      const unsubscribed = unsubscribedResult.count || 0;
      const bounced = bouncedResult.count || 0;
      
      return { 
        active, 
        unsubscribed, 
        bounced, 
        total: active + unsubscribed + bounced 
      };
    },
    enabled: !!listId,
  });

  // Delete list mutation
  const deleteList = useMutation({
    mutationFn: async () => {
      if (!listId) throw new Error("Lista não encontrada");
      const { error } = await supabase
        .from("email_marketing_lists")
        .delete()
        .eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-lists"] });
      toast.success("Lista excluída com sucesso");
      navigate("/email-marketing");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (listLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Lista não encontrada</h2>
        <p className="text-muted-foreground mb-4">A lista que você está procurando não existe ou foi excluída.</p>
        <Button onClick={() => navigate("/email-marketing")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Email Marketing
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/email-marketing")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
      
      <PageHeader
        title={list.name}
        description={list.description || "Visualize e gerencie os assinantes desta lista"}
        actions={
          <div className="flex items-center gap-3">
            {list.customer_tags && (
              <Badge
                variant="outline"
                className="gap-1.5 text-sm px-3 py-1"
                style={{
                  borderColor: list.customer_tags.color,
                  color: list.customer_tags.color,
                  backgroundColor: list.customer_tags.color + "15",
                }}
              >
                <Tag className="h-3.5 w-3.5" />
                {list.customer_tags.name}
              </Badge>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Lista
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.total || 0).toLocaleString("pt-BR")}</div>
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
            <div className="text-2xl font-bold text-primary">{stats?.active || 0}</div>
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
            <div className="text-2xl font-bold text-muted-foreground">{stats?.unsubscribed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Página Atual</CardTitle>
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
              Assinantes ({totalCount.toLocaleString("pt-BR")})
            </CardTitle>
            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                Exibindo {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount.toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {subscribersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">
                {debouncedSearch || statusFilter !== "all"
                  ? "Nenhum assinante encontrado com esses filtros"
                  : "Nenhum assinante nesta lista ainda"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Clientes com a tag vinculada serão sincronizados automaticamente
              </p>
            </div>
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
                              {sub.source}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Lista
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a lista "{list.name}"? Esta ação não pode ser desfeita.
              Os assinantes não serão removidos, apenas a lista.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteList.mutate()}
              disabled={deleteList.isPending}
            >
              {deleteList.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
