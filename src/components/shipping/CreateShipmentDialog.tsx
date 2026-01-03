import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Truck, Loader2, CheckCircle, Zap, Edit3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [mode, setMode] = useState<'automatic' | 'manual'>('automatic');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [manualTrackingCode, setManualTrackingCode] = useState<string>('');
  const [manualCarrier, setManualCarrier] = useState<string>('');
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
        .in('status', ['paid', 'processing', 'shipped'])
        .is('tracking_code', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as OrderForShipment[];
    },
    enabled: open && !!currentTenant?.id,
  });

  // Buscar transportadoras habilitadas (apenas Correios e Loggi para automático)
  const { data: providers } = useQuery({
    queryKey: ['shipping-providers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipping_providers')
        .select('id, provider, is_enabled')
        .eq('tenant_id', currentTenant.id)
        .eq('is_enabled', true)
        .in('provider', ['correios', 'loggi']);

      if (error) throw error;
      return data as ShippingProvider[];
    },
    enabled: open && !!currentTenant?.id,
  });

  // Criar remessa automática (Correios/Loggi)
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
      if (!data?.success) {
        if (data?.requires_manual) {
          throw new Error(data.error || 'Esta transportadora requer registro manual.');
        }
        throw new Error(data?.error || 'Erro ao criar remessa');
      }

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

  // Registrar remessa manual (Frenet ou externa)
  const registerManualShipment = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) throw new Error('Selecione um pedido');
      if (!manualTrackingCode.trim()) throw new Error('Informe o código de rastreio');
      if (!manualCarrier) throw new Error('Selecione a transportadora');
      
      const { data, error } = await supabase.functions.invoke('shipping-register-manual', {
        body: { 
          order_id: selectedOrderId,
          tracking_code: manualTrackingCode.trim(),
          carrier: manualCarrier,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao registrar remessa');

      return data;
    },
    onSuccess: (data) => {
      setCreatedShipment({ tracking_code: data.tracking_code, carrier: data.carrier });
      queryClient.invalidateQueries({ queryKey: ['orders-for-shipment'] });
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Remessa registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setSelectedOrderId('');
    setSelectedProvider('');
    setManualTrackingCode('');
    setManualCarrier('');
    setCreatedShipment(null);
    setMode('automatic');
    onOpenChange(false);
  };

  const selectedOrder = orders?.find(o => o.id === selectedOrderId);
  const isLoading = createShipment.isPending || registerManualShipment.isPending;

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
            {/* Tabs para modo */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'automatic' | 'manual')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="automatic" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Automática
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  Manual
                </TabsTrigger>
              </TabsList>

              {/* Seleção de Pedido (comum a ambos) */}
              <div className="space-y-2 mt-4">
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
                <div className="p-3 bg-muted/50 rounded-md space-y-1 mt-2">
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

              {/* Tab Automática */}
              <TabsContent value="automatic" className="space-y-4">
                <div className="space-y-2">
                  <Label>Transportadora</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Usar padrão configurado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Usar padrão</SelectItem>
                      {providers?.map((provider) => (
                        <SelectItem key={provider.id} value={provider.provider}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${provider.provider === 'correios' ? 'bg-blue-500' : 'bg-green-500'}`} />
                            {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Cria remessa via API (Correios ou Loggi com contrato próprio)
                  </p>
                </div>

                {(!providers || providers.length === 0) && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md text-sm text-yellow-700 dark:text-yellow-300">
                    Nenhuma transportadora automática configurada. Configure Correios ou Loggi nas configurações, ou use o modo Manual.
                  </div>
                )}

                <Button 
                  onClick={() => createShipment.mutate()} 
                  disabled={!selectedOrderId || isLoading || (!providers || providers.length === 0)}
                  className="w-full"
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
              </TabsContent>

              {/* Tab Manual */}
              <TabsContent value="manual" className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm text-blue-700 dark:text-blue-300">
                  Use este modo para etiquetas compradas externamente (ex: Frenet, Melhor Envio) ou outros transportadores.
                </div>

                <div className="space-y-2">
                  <Label>Código de Rastreio</Label>
                  <Input 
                    placeholder="Ex: XX123456789BR"
                    value={manualTrackingCode}
                    onChange={(e) => setManualTrackingCode(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Transportadora</Label>
                  <Select value={manualCarrier} onValueChange={setManualCarrier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a transportadora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frenet">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          Frenet
                        </span>
                      </SelectItem>
                      <SelectItem value="correios">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Correios
                        </span>
                      </SelectItem>
                      <SelectItem value="loggi">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Loggi
                        </span>
                      </SelectItem>
                      <SelectItem value="jadlog">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          JadLog
                        </span>
                      </SelectItem>
                      <SelectItem value="total_express">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          Total Express
                        </span>
                      </SelectItem>
                      <SelectItem value="outro">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-500" />
                          Outro
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => registerManualShipment.mutate()} 
                  disabled={!selectedOrderId || !manualTrackingCode.trim() || !manualCarrier || isLoading}
                  className="w-full"
                >
                  {registerManualShipment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Registrar Remessa
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
