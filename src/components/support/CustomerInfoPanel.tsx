import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, User, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/hooks/useConversations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomerInfoPanelProps {
  conversation: Conversation | null;
}

export function CustomerInfoPanel({ conversation }: CustomerInfoPanelProps) {
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

  if (!conversation) {
    return null;
  }

  return (
    <div className="w-80 border-l flex flex-col overflow-hidden">
      <div className="p-3 border-b">
        <h3 className="font-semibold">Informações</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
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
    </div>
  );
}
