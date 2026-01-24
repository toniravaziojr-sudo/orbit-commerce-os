import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, Mail, Trash2, Search, Tag, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ListDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: {
    id: string;
    name: string;
    description?: string;
    tag_id?: string;
    customer_tags?: {
      id: string;
      name: string;
      color: string;
    };
  } | null;
}

export function ListDetailDrawer({ open, onOpenChange, list }: ListDetailDrawerProps) {
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch subscribers for this list - simplified query
  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["list-subscribers", list?.id],
    queryFn: async () => {
      if (!list?.id) return [];
      
      // Get all subscribers and filter by list
      const { data, error } = await supabase
        .from("email_marketing_subscribers")
        .select("id, email, name, status, created_at, source")
        .order("created_at", { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!list?.id && open,
  });

  // Delete list mutation
  const deleteList = useMutation({
    mutationFn: async () => {
      if (!list?.id) throw new Error("Lista não encontrada");
      
      const { error } = await supabase
        .from("email_marketing_lists")
        .delete()
        .eq("id", list.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-lists"] });
      queryClient.invalidateQueries({ queryKey: ["email-marketing-subscribers"] });
      toast.success("Lista excluída com sucesso");
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir lista: " + error.message);
    },
  });

  const filteredSubscribers = subscribers.filter((sub: any) =>
    (sub.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    sub.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = subscribers.filter((s: any) => s.status === "active").length;
  const unsubscribedCount = subscribers.filter((s: any) => s.status === "unsubscribed").length;

  if (!list) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-xl font-semibold">{list.name}</DrawerTitle>
                <DrawerDescription className="mt-1">
                  {list.description || "Sem descrição"}
                </DrawerDescription>
              </div>
              {list.customer_tags && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5"
                  style={{ backgroundColor: list.customer_tags.color + "20", color: list.customer_tags.color, borderColor: list.customer_tags.color }}
                >
                  <Tag className="h-3 w-3" />
                  {list.customer_tags.name}
                </Badge>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{subscribers.length}</span>
                <span className="text-muted-foreground">assinantes</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
                <span className="font-medium">{activeCount}</span>
                <span className="text-muted-foreground">ativos</span>
              </div>
              {unsubscribedCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="font-medium">{unsubscribedCount}</span>
                  <span className="text-muted-foreground">descadastrados</span>
                </div>
              )}
            </div>
          </DrawerHeader>

          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar assinantes..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 p-4" style={{ maxHeight: "45vh" }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubscribers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {search ? "Nenhum assinante encontrado" : "Nenhum assinante nesta lista ainda"}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Clientes com a tag vinculada serão sincronizados automaticamente
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSubscribers.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{sub.name || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground truncate">{sub.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={sub.status === "active" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {sub.status === "active" ? "Ativo" : sub.status === "unsubscribed" ? "Descadastrado" : sub.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(sub.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DrawerFooter className="border-t pt-4">
            <div className="flex justify-between w-full">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Lista
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
