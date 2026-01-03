import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Truck, Loader2, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CreateShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderForShipment {
  id: string;
  order_number: string;
  customer_name: string;
  shipping_city: string;
  shipping_state: string;
  total: number;
  status: string;
}

interface ShippingProvider {
  id: string;
  provider: string;
  is_enabled: boolean;
}

export function CreateShipmentDialog({ open, onOpenChange }: CreateShipmentDialogProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [createdShipment, setCreatedShipment] = useState<{ tracking_code: string; carrier: string } | null>(null);

  // Buscar pedidos pagos sem remessa
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders-for-shipment', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, shipping_city, shipping_state, total, status')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['paid', 'processing'])
        .is('tracking_code', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as OrderForShipment[];
    },
    enabled: open && !!currentTenant?.id,
  });

  // Buscar transportadoras habilitadas
  const { data: providers } = useQuery({
    queryKey: ['shipping-providers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipping_providers')
        .select('id, provider, is_enabled')
        .eq('tenant_id', currentTenant.id)
        .eq('is_enabled', true);

      if (error) throw error;
      return data as ShippingProvider[];
    },
    enabled: open && !!currentTenant?.id,
  });

  // Criar remessa
  const createShipment = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) throw new Error('Selecione um pedido');
      
      const { data, error } = await supabase.functions.invoke('shipping-create-shipment', {
        body: { 
          order_id: selectedOrderId,
          provider_override: selectedProvider || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar remessa');

      return data;
    },
    onSuccess: (data) => {
      setCreatedShipment({ tracking_code: data.tracking_code, carrier: data.carrier });
      queryClient.invalidateQueries({ queryKey: ['orders-for-shipment'] });
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Remessa criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setSelectedOrderId('');
    setSelectedProvider('');
    setCreatedShipment(null);
    onOpenChange(false);
  };

  const selectedOrder = orders?.find(o => o.id === selectedOrderId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Criar Remessa
          </DialogTitle>
          <DialogDescription>
            Selecione um pedido para gerar a remessa e código de rastreio.
          </DialogDescription>
        </DialogHeader>

        {createdShipment ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-4 p-6 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div className="text-center">
                <h3 className="font-semibold text-lg">Remessa Criada!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Transportadora: {createdShipment.carrier}
                </p>
              </div>
              <div className="bg-background p-3 rounded-md border w-full text-center">
                <p className="text-xs text-muted-foreground mb-1">Código de Rastreio</p>
                <p className="font-mono font-bold text-lg">{createdShipment.tracking_code}</p>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Seleção de Pedido */}
            <div className="space-y-2">
              <Label>Pedido</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder={ordersLoading ? 'Carregando...' : 'Selecione um pedido'} />
                </SelectTrigger>
                <SelectContent>
                  {orders?.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum pedido aguardando remessa
                    </div>
                  )}
                  {orders?.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.order_number}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-sm">{order.customer_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detalhes do pedido selecionado */}
            {selectedOrder && (
              <div className="p-3 bg-muted/50 rounded-md space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span>{selectedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destino:</span>
                  <span>{selectedOrder.shipping_city}, {selectedOrder.shipping_state}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor:</span>
                  <span>R$ {selectedOrder.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{selectedOrder.status}</Badge>
                </div>
              </div>
            )}

            {/* Seleção de Transportadora (opcional) */}
            <div className="space-y-2">
              <Label>Transportadora (opcional)</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Usar padrão configurado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Usar padrão</SelectItem>
                  {providers?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.provider}>
                      {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se não selecionar, será usada a transportadora padrão do pedido ou das configurações fiscais.
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={() => createShipment.mutate()} 
                disabled={!selectedOrderId || createShipment.isPending}
                className="flex-1"
              >
                {createShipment.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Criar Remessa
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
