import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, User, Clock, Tag, StickyNote, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation } from "@/hooks/useConversations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CustomerInfoPanelProps {
  conversation: Conversation | null;
}

export function CustomerInfoPanel({ conversation }: CustomerInfoPanelProps) {
  const { user, currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Fetch customer details
  const { data: customer } = useQuery({
    queryKey: ['customer', conversation?.customer_id],
    queryFn: async () => {
      if (!conversation?.customer_id) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', conversation.customer_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.customer_id,
  });

  // Fetch notes for this conversation
  const { data: notes } = useQuery({
    queryKey: ['conversation-notes', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_name, created_at')
        .eq('conversation_id', conversation.id)
        .eq('is_note', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.id,
  });

  // Mutation to add note
  const addNote = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation?.id || !currentTenant?.id) throw new Error('Missing context');
      
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          tenant_id: currentTenant.id,
          content,
          direction: 'outbound',
          sender_type: 'agent',
          sender_name: user?.email,
          is_note: true,
          is_internal: true,
          content_type: 'text',
          delivery_status: 'delivered',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-notes', conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversation?.id] });
      setNewNote('');
      setShowNoteInput(false);
      toast.success('Nota adicionada');
    },
    onError: () => {
      toast.error('Erro ao adicionar nota');
    },
  });

  // Fetch order if linked
  const { data: order } = useQuery({
    queryKey: ['order', conversation?.order_id],
    queryFn: async () => {
      if (!conversation?.order_id) return null;
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', conversation.order_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.order_id,
  });

  // Fetch recent orders for customer
  const { data: recentOrders } = useQuery({
    queryKey: ['customer-orders', conversation?.customer_id],
    queryFn: async () => {
      if (!conversation?.customer_id) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, payment_status, created_at')
        .eq('customer_id', conversation.customer_id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!conversation?.customer_id,
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote.mutate(newNote.trim());
  };

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold">Informações</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Customer Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Nome:</span>
                <span className="ml-2 font-medium">
                  {customer?.full_name || conversation.customer_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-2">{customer?.email || conversation.customer_email || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone:</span>
                <span className="ml-2">{customer?.phone || conversation.customer_phone || '-'}</span>
              </div>
              {customer && (
                <>
                  <div>
                    <span className="text-muted-foreground">Cliente desde:</span>
                    <span className="ml-2">
                      {customer.first_order_at
                        ? formatDistanceToNow(new Date(customer.first_order_at), { addSuffix: true, locale: ptBR })
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total gasto:</span>
                    <span className="ml-2 font-medium">
                      {customer.total_spent
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(customer.total_spent)
                        : 'R$ 0,00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pedidos:</span>
                    <span className="ml-2">{customer.total_orders || 0}</span>
                  </div>
                </>
              )}
              {conversation.customer_id && (
                <Button variant="link" size="sm" className="p-0 h-auto">
                  Ver perfil completo →
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notas
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => setShowNoteInput(!showNoteInput)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showNoteInput && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escreva uma nota interna..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setShowNoteInput(false);
                        setNewNote('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || addNote.isPending}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {notes && notes.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {notes.map((note) => (
                    <div 
                      key={note.id} 
                      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2"
                    >
                      <p className="text-sm">{note.content}</p>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span>{note.sender_name}</span>
                        <span>{format(new Date(note.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showNoteInput && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma nota ainda
                </p>
              )}
            </CardContent>
          </Card>

          {/* Linked Order */}
          {order && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Pedido Vinculado
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{order.order_number}</span>
                  <Badge variant="secondary">{order.payment_status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <span className="ml-2 font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total || 0)}
                  </span>
                </div>
                <Button variant="link" size="sm" className="p-0 h-auto">
                  Ver detalhes →
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Orders */}
          {recentOrders && recentOrders.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pedidos Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{o.order_number}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.total || 0)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {o.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {conversation.tags && conversation.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {conversation.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
