// =============================================
// TRACKING LOOKUP BLOCK - Public tracking search
// =============================================

import React, { useState } from 'react';
import { Package, Search, MapPin, Clock, CheckCircle2, Truck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { BlockRenderContext } from '@/lib/builder/types';

interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurred_at: string;
}

interface ShipmentResult {
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  order_number: string;
  events: TrackingEvent[];
}

interface TrackingLookupBlockProps {
  title?: string;
  description?: string;
  context?: BlockRenderContext;
  isEditing?: boolean;
}

// Status icons use CSS classes that inherit theme colors via CSS variables
// sf-accent-icon = --theme-accent-color (success states)
// sf-tag-warning/sf-tag-danger classes for other states
const STATUS_ICONS: Record<string, React.ReactNode> = {
  label_created: <Package className="w-5 h-5" />,
  posted: <Package className="w-5 h-5" />,
  in_transit: <Truck className="w-5 h-5" />,
  out_for_delivery: <Truck className="w-5 h-5 text-primary" />,
  delivered: <CheckCircle2 className="w-5 h-5 sf-accent-icon" style={{ color: 'var(--theme-accent-color, var(--primary))' }} />,
  failed: <AlertCircle className="w-5 h-5" style={{ color: 'var(--theme-warning-bg, #f97316)' }} />,
  returned: <AlertCircle className="w-5 h-5" style={{ color: 'var(--theme-danger-bg, #ef4444)' }} />,
  canceled: <AlertCircle className="w-5 h-5 text-muted-foreground" />,
  unknown: <Clock className="w-5 h-5 text-muted-foreground" />,
};

const STATUS_LABELS: Record<string, string> = {
  label_created: 'Etiqueta criada',
  posted: 'Postado',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  failed: 'Tentativa de entrega',
  returned: 'Devolvido',
  canceled: 'Cancelado',
  unknown: 'Aguardando atualização',
};

export function TrackingLookupBlock({
  title = 'Rastrear Pedido',
  description = 'Acompanhe o status da sua entrega',
  context,
  isEditing,
}: TrackingLookupBlockProps) {
  // Get tenant ID from context (provided by Builder or storefront)
  const tenantId = context?.settings?.tenant_id;

  const [activeTab, setActiveTab] = useState<'code' | 'email'>('code');
  const [trackingCode, setTrackingCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ShipmentResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!tenantId) {
      setError('Configuração da loja não encontrada');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const body = activeTab === 'code'
        ? { tenant_id: tenantId, tracking_code: trackingCode.trim() }
        : { tenant_id: tenantId, customer_name: customerName.trim(), customer_email: customerEmail.trim() };

      const { data, error: fnError } = await supabase.functions.invoke('tracking-lookup', {
        body,
      });

      if (fnError) {
        console.error('Tracking lookup error:', fnError);
        setError('Erro ao buscar rastreio. Tente novamente.');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setResults(data?.shipments || []);
    } catch (err) {
      console.error('Tracking lookup error:', err);
      setError('Erro ao buscar rastreio. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  // Editor preview
  if (isEditing) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <div className="text-center mb-8">
          <Package className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 mb-6">
              <div className="flex-1 px-4 py-2 bg-muted rounded text-center text-sm font-medium">
                Código de rastreio
              </div>
              <div className="flex-1 px-4 py-2 rounded text-center text-sm text-muted-foreground">
                Nome e E-mail
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-primary rounded flex items-center justify-center text-primary-foreground text-sm">
                Buscar
              </div>
            </div>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          [Prévia do bloco de rastreio - funciona no storefront público]
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="text-center mb-8">
        <Package className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'code' | 'email')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="code">Código de rastreio</TabsTrigger>
              <TabsTrigger value="email">Nome e E-mail</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="code" className="space-y-4">
                <div>
                  <Label htmlFor="tracking-code">Código de rastreio</Label>
                  <Input
                    id="tracking-code"
                    placeholder="Ex: AA123456789BR"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    required={activeTab === 'code'}
                  />
                </div>
              </TabsContent>

              <TabsContent value="email" className="space-y-4">
                <div>
                  <Label htmlFor="customer-name">Seu nome</Label>
                  <Input
                    id="customer-name"
                    placeholder="Nome completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required={activeTab === 'email'}
                  />
                </div>
                <div>
                  <Label htmlFor="customer-email">Seu e-mail</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required={activeTab === 'email'}
                  />
                </div>
              </TabsContent>

              <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Search className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error message */}
      {error && (
        <Card className="border-destructive bg-destructive/5 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results !== null && !isLoading && (
        <>
          {results.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Nenhum envio encontrado</p>
                <p className="text-muted-foreground text-sm">
                  Verifique os dados informados e tente novamente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {results.map((shipment, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {STATUS_ICONS[shipment.delivery_status] || STATUS_ICONS.unknown}
                          {STATUS_LABELS[shipment.delivery_status] || shipment.delivery_status}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {shipment.order_number && (
                            <span className="mr-3">Pedido: {shipment.order_number}</span>
                          )}
                          <span>Código: {shipment.tracking_code}</span>
                        </CardDescription>
                      </div>
                      {shipment.carrier && (
                        <span className="text-xs bg-muted px-2 py-1 rounded uppercase">
                          {shipment.carrier}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* ETA or delivered date */}
                    {shipment.delivered_at ? (
                      <div className="flex items-center gap-2 text-green-600 mb-6 p-3 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">
                          Entregue em {format(new Date(shipment.delivered_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    ) : shipment.estimated_delivery_at ? (
                      <div className="flex items-center gap-2 text-primary mb-6 p-3 bg-primary/5 rounded-lg">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">
                          Previsão de entrega: {format(new Date(shipment.estimated_delivery_at), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    ) : null}

                    {/* Timeline */}
                    {shipment.events.length > 0 && (
                      <div className="relative">
                        <h4 className="font-medium mb-4">Histórico</h4>
                        <div className="space-y-0">
                          {shipment.events.map((event, eventIdx) => (
                            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                              {/* Timeline line */}
                              {eventIdx < shipment.events.length - 1 && (
                                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
                              )}
                              
                              {/* Icon */}
                              <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                {STATUS_ICONS[event.status] || <Package className="w-5 h-5" />}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{event.description}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                  <span>
                                    {format(new Date(event.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {shipment.events.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        Aguardando atualização do rastreio
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
