import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ptBR } from 'date-fns/locale';
import { Package, Truck, Printer, ExternalLink, AlertTriangle, CheckCircle, Clock, FileText, Send, Pencil, Trash2, Plus, Lock, Loader2, RefreshCw } from 'lucide-react';
import { DraftShipmentDialog } from './DraftShipmentDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCreateShipment, useDispatchShipment } from '@/hooks/useShipments';
import { toast } from 'sonner';

import { formatDateTimeBR, formatDayMonthTimeBR } from "@/lib/date-format";

interface ShipmentRecord {
  id: string;
  order_id: string;
  source_pedido_venda_id?: string | null;
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  created_at: string;
  source: string | null;
  metadata: any;
  manually_adjusted?: boolean;
  service_name?: string | null;
  label_url: string | null;
  nfe_key: string | null;
  invoice_id: string | null;
  order?: {
    id?: string;
    order_number: string;
    customer_name: string;
    shipping_carrier?: string;
    shipping_city?: string;
    shipping_state?: string;
    total?: number;
    created_at?: string;
    status?: string;
    resolved_shipping_provider_kind?: string | null;
  };
  pv?: {
    numero: number | null;
    dest_nome: string | null;
    dest_endereco_municipio: string | null;
    dest_endereco_uf: string | null;
  } | null;
  invoice?: {
    danfe_url: string | null;
    chave_acesso: string | null;
    numero: number | null;
  } | null;
}


const CARRIERS = [
  { value: 'all', label: 'Todas Transportadoras' },
  { value: 'correios', label: 'Correios' },
  { value: 'loggi', label: 'Loggi' },
  { value: 'frenet', label: 'Frenet' },
  { value: 'outros', label: 'Outros' },
];

export function ShipmentGenerator() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const createShipment = useCreateShipment();
  const dispatchShipment = useDispatchShipment();
  
  const [activeTab, setActiveTab] = useState('prontos');
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedIssued, setSelectedIssued] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [dispatchDialog, setDispatchDialog] = useState<ShipmentRecord | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [deletingShipmentId, setDeletingShipmentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingShipmentId, setRetryingShipmentId] = useState<string | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['orders-ready-shipment'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-issued'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-failed'] });
  };

  // === TAB 1: Prontos para emitir remessa ===
  const { data: readyOrders, isLoading: loadingReady } = useQuery({
    queryKey: ['orders-ready-shipment', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select<string, any>(`
          id, order_id, source_pedido_venda_id, carrier, service_name, manually_adjusted, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders(id, order_number, customer_name, shipping_carrier, shipping_city, shipping_state, total, created_at, status, resolved_shipping_provider_kind)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('delivery_status', 'draft' as any)
        .order('created_at', { ascending: false });

      if (selectedCarrier !== 'all' && selectedCarrier !== 'outros') {
        query = query.ilike('carrier', `%${selectedCarrier}%`);
      }
      if (startDate) {
        const { toSaoPauloStartIso } = await import('@/lib/date-timezone');
        query = query.gte('created_at', toSaoPauloStartIso(startDate));
      }
      if (endDate) {
        const { toSaoPauloEndIso } = await import('@/lib/date-timezone');
        query = query.lte('created_at', toSaoPauloEndIso(endDate));
      }

      const { data, error } = await query;
      if (error) throw error;
      const shipments = ((data || []) as ShipmentRecord[]).filter(
        (s) => (s.order as any)?.resolved_shipping_provider_kind !== 'gateway'
      );

      // Fallback: para remessas sem pedido vinculado, buscar dados do destinatário no PV
      const pvIds = shipments
        .filter(s => !s.order && s.source_pedido_venda_id)
        .map(s => s.source_pedido_venda_id as string);
      if (pvIds.length > 0) {
        const { data: pvs } = await supabase
          .from('fiscal_invoices')
          .select('id, numero, dest_nome, dest_endereco_municipio, dest_endereco_uf')
          .in('id', pvIds);
        const pvMap = Object.fromEntries((pvs || []).map((p: any) => [p.id, p]));
        shipments.forEach(s => {
          if (!s.order && s.source_pedido_venda_id && pvMap[s.source_pedido_venda_id]) {
            s.pv = pvMap[s.source_pedido_venda_id];
          }
        });
      }
      return shipments;
    },
    enabled: !!currentTenant?.id,
  });



  // === TAB 2: Remessas emitidas (has tracking, not draft/failed) ===
  const { data: issuedShipments, isLoading: loadingIssued } = useQuery({
    queryKey: ['shipments-issued', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select<string, any>(`
          id, order_id, source_pedido_venda_id, tracking_code, carrier, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders(order_number, customer_name, status)
        `)
        .eq('tenant_id', currentTenant.id)
        .not('delivery_status', 'in', '("draft","failed")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedCarrier !== 'all' && selectedCarrier !== 'outros') {
        query = query.ilike('carrier', `%${selectedCarrier}%`);
      }
      if (startDate) {
        const { toSaoPauloStartIso } = await import('@/lib/date-timezone');
        query = query.gte('created_at', toSaoPauloStartIso(startDate));
      }
      if (endDate) {
        const { toSaoPauloEndIso } = await import('@/lib/date-timezone');
        query = query.lte('created_at', toSaoPauloEndIso(endDate));
      }

      // Fetch DANFE URLs for invoices
      const { data, error } = await query;
      if (error) throw error;

      const shipments = (data || []) as ShipmentRecord[];

      // Fetch invoice data for shipments that have invoice_id
      const invoiceIds = shipments.map(s => s.invoice_id).filter(Boolean);
      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase
          .from('fiscal_invoices')
          .select('id, danfe_url, chave_acesso, numero')
          .in('id', invoiceIds as string[]);

        if (invoices) {
          const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]));
          shipments.forEach(s => {
            if (s.invoice_id && invoiceMap[s.invoice_id]) {
              s.invoice = invoiceMap[s.invoice_id];
            }
          });
        }
      }

      // Fallback PV: remessas sem pedido vinculado (fluxo PV manual/duplicado)
      const pvIds = shipments
        .filter(s => !s.order && s.source_pedido_venda_id)
        .map(s => s.source_pedido_venda_id as string);
      if (pvIds.length > 0) {
        const { data: pvs } = await supabase
          .from('fiscal_invoices')
          .select('id, numero, dest_nome')
          .in('id', pvIds);
        const pvMap = Object.fromEntries((pvs || []).map((p: any) => [p.id, p]));
        shipments.forEach(s => {
          if (!s.order && s.source_pedido_venda_id && pvMap[s.source_pedido_venda_id]) {
            s.pv = pvMap[s.source_pedido_venda_id];
          }
        });
      }

      return shipments;
    },
    enabled: !!currentTenant?.id,
  });

  // === TAB 3: Remessas pendentes (failed) ===
  // Vínculo canônico é com PV (source_pedido_venda_id). Pedido é opcional —
  // PV manual/duplicado também aparece aqui.
  const { data: failedShipments, isLoading: loadingFailed } = useQuery({
    queryKey: ['shipments-failed', currentTenant?.id, selectedCarrier],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select<string, any>(`
          id, order_id, source_pedido_venda_id, tracking_code, carrier, service_name, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders(order_number, customer_name, status, resolved_shipping_provider_kind)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('delivery_status', 'failed' as any)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const shipments = ((data || []) as ShipmentRecord[]).filter(
        (s) => (s.order as any)?.resolved_shipping_provider_kind !== 'gateway'
      );

      // Fallback: para falhas sem pedido vinculado, buscar dados do PV
      const pvIds = shipments
        .filter(s => !s.order && s.source_pedido_venda_id)
        .map(s => s.source_pedido_venda_id as string);
      if (pvIds.length > 0) {
        const { data: pvs } = await supabase
          .from('fiscal_invoices')
          .select('id, numero, dest_nome, dest_endereco_municipio, dest_endereco_uf')
          .in('id', pvIds);
        const pvMap = Object.fromEntries((pvs || []).map((p: any) => [p.id, p]));
        shipments.forEach(s => {
          if (!s.order && s.source_pedido_venda_id && pvMap[s.source_pedido_venda_id]) {
            s.pv = pvMap[s.source_pedido_venda_id];
          }
        });
      }
      return shipments;
    },
    enabled: !!currentTenant?.id,
  });

  // === ACTIONS ===
  const toggleOrder = (shipmentId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(shipmentId)) newSelected.delete(shipmentId);
    else newSelected.add(shipmentId);
    setSelectedOrders(newSelected);
  };

  const toggleAll = () => {
    if (!readyOrders) return;
    if (selectedOrders.size === readyOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(readyOrders.map(s => s.id)));
    }
  };

  const toggleIssued = (id: string) => {
    const newSelected = new Set(selectedIssued);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIssued(newSelected);
  };

  const toggleAllIssued = () => {
    if (!issuedShipments) return;
    if (selectedIssued.size === issuedShipments.length) {
      setSelectedIssued(new Set());
    } else {
      setSelectedIssued(new Set(issuedShipments.map(s => s.id)));
    }
  };

  const handleGenerateShipments = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Selecione pelo menos um rascunho');
      return;
    }

    setIsGenerating(true);
    const successes: string[] = [];
    const failures: { label: string; reason: string }[] = [];

    const byId = new Map((readyOrders || []).map(s => [s.id, s]));

    for (const shipmentId of selectedOrders) {
      const ship = byId.get(shipmentId);
      const label = (ship?.order as any)?.order_number
        ? `Pedido #${(ship?.order as any).order_number}`
        : ship?.pv?.numero
          ? `PV ${ship.pv.numero}`
          : `Rascunho ${shipmentId.substring(0, 8)}`;
      try {
        const result = await dispatchShipment.mutateAsync({ shipment_id: shipmentId });
        if (result?.success && result.tracking_code) {
          successes.push(`${label}: ${result.tracking_code}`);
        } else {
          failures.push({ label, reason: result?.error || 'erro desconhecido' });
        }
      } catch (error: any) {
        failures.push({ label, reason: error?.message || 'erro inesperado' });
      }
    }

    setIsGenerating(false);
    setSelectedOrders(new Set());

    if (successes.length > 0) {
      toast.success(`${successes.length} remessa(s) emitida(s)`, {
        description: successes.slice(0, 5).join('\n'),
      });
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} remessa(s) não emitida(s)`, {
        description: failures.slice(0, 5).map(f => `${f.label}: ${f.reason}`).join('\n'),
        duration: 10000,
      });
    }
    invalidateAll();
  };

  const handleRetryShipment = async (shipmentId: string) => {
    setRetryingShipmentId(shipmentId);
    try {
      // Volta o rascunho para 'draft' e reemite via o próprio shipment_id.
      // Funciona para rascunhos com ou sem pedido vinculado (PV manual).
      await supabase
        .from('shipments')
        .update({ delivery_status: 'draft' as any })
        .eq('id', shipmentId)
        .eq('tenant_id', currentTenant?.id!)
        .eq('delivery_status', 'failed' as any);

      const result = await dispatchShipment.mutateAsync({ shipment_id: shipmentId });
      if (result?.success && result.tracking_code) {
        toast.success(`Remessa reenviada. Código: ${result.tracking_code}`);
      } else {
        toast.error(result?.error || 'Falha ao reenviar remessa');
      }
      invalidateAll();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao reenviar remessa');
    } finally {
      setRetryingShipmentId(null);
    }
  };

  // === Ações manuais nos rascunhos ===
  const openCreateDraft = () => {
    setEditingShipmentId(null);
    setDraftDialogOpen(true);
  };

  const openEditDraft = (id: string) => {
    setEditingShipmentId(id);
    setDraftDialogOpen(true);
  };

  const handleDeleteDraft = async () => {
    if (!deletingShipmentId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', deletingShipmentId);
      if (error) throw error;
      toast.success('Rascunho excluído');
      setDeletingShipmentId(null);
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    } finally {
      setIsDeleting(false);
    }
  };


  // Imprimir/Reimprimir etiqueta — sempre disponível.
  // Chama a edge que devolve signed URL (se existir no bucket) ou baixa nos Correios e armazena.
  const handlePrintLabel = async (shipment: ShipmentRecord, forceRefresh = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('shipping-get-label', {
        body: { shipment_id: shipment.id, force_refresh: forceRefresh },
      });
      if (error) {
        toast.error('Falha ao obter etiqueta');
        return;
      }
      if (data?.success && data.label_url) {
        window.open(data.label_url, '_blank');
        return;
      }
      if (data?.success && data.label_base64) {
        const bin = atob(data.label_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        return;
      }
      toast.error(data?.error || 'Etiqueta não disponível');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao imprimir etiqueta');
    }
  };

  // Print DANFE / Declaração de Conteúdo
  const handlePrintDanfe = async (shipment: ShipmentRecord) => {
    if (shipment.invoice?.danfe_url) {
      window.open(shipment.invoice.danfe_url, '_blank');
      return;
    }
    // Fallback: fetch from DB
    if (shipment.invoice_id) {
      const { data } = await supabase
        .from('fiscal_invoices')
        .select('danfe_url')
        .eq('id', shipment.invoice_id)
        .single();
      if (data?.danfe_url) {
        window.open(data.danfe_url, '_blank');
        return;
      }
    }
    // Sem NF-e — tenta Declaração de Conteúdo vinculada ao PV/pedido
    try {
      const declRow = await fetchDeclarationFor(shipment);
      if (declRow) {
        const { reprintExistingDeclaration } = await import('@/lib/declaracaoConteudo');
        reprintExistingDeclaration(declRow as any);
        return;
      }
    } catch (e: any) {
      console.error('DC print error', e);
    }
    toast.error('Documento fiscal (NF-e/DC) não disponível para impressão');
  };

  // Busca a Declaração de Conteúdo existente para a remessa
  const fetchDeclarationFor = async (shipment: ShipmentRecord) => {
    let q = supabase.from('shipping_content_declarations').select('*').eq('status', 'issued');
    if (shipment.source_pedido_venda_id) q = q.eq('fiscal_invoice_id', shipment.source_pedido_venda_id);
    else if (shipment.order_id) q = q.eq('order_id', shipment.order_id);
    else return null;
    const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data;
  };

  // Dispatch action: open dialog with print options + confirm
  const handleDispatchClick = (shipment: ShipmentRecord) => {
    setDispatchDialog(shipment);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchDialog || !currentTenant?.id) return;
    setIsDispatching(true);

    try {
      // Pedido real (quando existir) — PVs manuais/duplicados não têm pedido real
      if (dispatchDialog.order_id) {
        await supabase
          .from('orders')
          .update({
            status: 'dispatched' as any,
            shipped_at: new Date().toISOString(),
          })
          .eq('id', dispatchDialog.order_id);

        await supabase
          .from('order_history')
          .insert({
            order_id: dispatchDialog.order_id,
            action: 'dispatched',
            description: `Despacho confirmado. Etiqueta: ${dispatchDialog.tracking_code || 'N/A'}`,
          });
      }

      // Marca a remessa como postada — independe da existência de pedido real
      await supabase
        .from('shipments')
        .update({ delivery_status: 'posted' as any, last_status_at: new Date().toISOString() })
        .eq('id', dispatchDialog.id)
        .eq('tenant_id', currentTenant.id);

      toast.success(dispatchDialog.order_id ? 'Pedido marcado como despachado' : 'Remessa marcada como despachada');
      setDispatchDialog(null);
      invalidateAll();
    } catch (error) {
      toast.error('Erro ao confirmar despacho');
    } finally {
      setIsDispatching(false);
    }
  };

  // Batch print
  const handleBatchPrint = async (type: 'labels' | 'danfes' | 'both') => {
    if (!issuedShipments) return;
    const selected = issuedShipments.filter(s => selectedIssued.has(s.id));
    
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma remessa');
      return;
    }

    let opened = 0;
    for (const s of selected) {
      if (type === 'labels' || type === 'both') {
        await handlePrintLabel(s);
        opened++;
      }
      if (type === 'danfes' || type === 'both') {
        await handlePrintDanfe(s);
        opened++;
      }
    }

    if (opened === 0) {
      toast.error('Nenhum documento disponível para impressão');
    } else {
      toast.success(`${opened} documento(s) aberto(s) para impressão`);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'outline' },
      label_created: { label: 'Despachado', variant: 'secondary' },
      posted: { label: 'Despachado', variant: 'secondary' },
      in_transit: { label: 'Em trânsito', variant: 'secondary' },
      out_for_delivery: { label: 'Saiu p/ entrega', variant: 'secondary' },
      delivered: { label: 'Entregue', variant: 'default' },
      failed: { label: 'Falha', variant: 'destructive' },
      returned: { label: 'Devolvido', variant: 'destructive' },
    };
    const cfg = config[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const readyCount = readyOrders?.length || 0;
  const issuedCount = issuedShipments?.length || 0;
  const failedCount = failedShipments?.length || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Transportadora" />
          </SelectTrigger>
          <SelectContent>
            {CARRIERS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          label="Período"
        />
      </div>

      {/* 3-Tab Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="prontos" className="gap-2">
            <Package className="h-4 w-4" />
            Prontos para emitir
            {readyCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {readyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emitidas" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Remessas emitidas
            {issuedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {issuedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pendentes
            {failedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {failedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Prontos para emitir */}
        <TabsContent value="prontos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Prontos para emitir remessa
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {readyCount} pedido(s){selectedOrders.size > 0 ? ` • ${selectedOrders.size} selecionado(s)` : ''}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={openCreateDraft} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Criar novo rascunho
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateShipments}
                    disabled={selectedOrders.size === 0 || isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>Emitindo...</>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        Emitir Remessa{selectedOrders.size > 0 ? ` (${selectedOrders.size})` : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingReady ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : readyCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhum pedido pronto para emitir remessa
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={selectedOrders.size === readyCount && readyCount > 0}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Frete</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>NF-e</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {readyOrders!.map(shipment => {
                          const order = shipment.order as any;
                          const meta = shipment.metadata as any;
                          const hasNFe = !!shipment.nfe_key;
                          return (
                            <TableRow 
                              key={shipment.id}
                              className="cursor-pointer"
                              onClick={() => toggleOrder(shipment.id)}
                            >

                              <TableCell onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedOrders.has(shipment.id)}
                                  onCheckedChange={() => toggleOrder(shipment.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {order?.order_number ? `#${order.order_number}` : (shipment.pv?.numero ? `PV ${shipment.pv.numero}` : '—')}
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate">
                                {order?.customer_name || shipment.pv?.dest_nome || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {shipment.carrier || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {(order?.shipping_city || shipment.pv?.dest_endereco_municipio || '—')}/{(order?.shipping_state || shipment.pv?.dest_endereco_uf || '—')}
                              </TableCell>

                              <TableCell className="text-muted-foreground text-sm">
                                {meta?.weight_grams ? `${meta.weight_grams}g` : '-'}
                              </TableCell>
                              <TableCell>
                                {hasNFe ? (
                                  <Badge variant="default" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Vinculada
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Sem NF-e
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()} className="text-right">
                                <div className="flex gap-1 justify-end items-center">
                                  {shipment.manually_adjusted && (
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Ajustada manualmente" />
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar rascunho"
                                    onClick={() => openEditDraft(shipment.id)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir rascunho"
                                    onClick={() => setDeletingShipmentId(shipment.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* TAB 2: Remessas emitidas */}
        <TabsContent value="emitidas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Remessas emitidas
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedIssued.size > 0 && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('labels')} className="gap-1">
                        <Printer className="h-3 w-3" />
                        Etiquetas ({selectedIssued.size})
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('danfes')} className="gap-1">
                        <FileText className="h-3 w-3" />
                        DANFEs ({selectedIssued.size})
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('both')} className="gap-1">
                        <Printer className="h-3 w-3" />
                        Tudo ({selectedIssued.size})
                      </Button>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {issuedCount} remessa(s)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingIssued ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : issuedCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhuma remessa emitida
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIssued.size === issuedCount && issuedCount > 0}
                            onCheckedChange={toggleAllIssued}
                          />
                        </TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Rastreio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuedShipments!.map(shipment => (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIssued.has(shipment.id)}
                              onCheckedChange={() => toggleIssued(shipment.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {shipment.order?.order_number
                              ? `#${shipment.order.order_number}`
                              : shipment.pv?.numero
                                ? `PV ${shipment.pv.numero}`
                                : `Rascunho ${shipment.id.substring(0, 8)}`}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {shipment.order?.customer_name || shipment.pv?.dest_nome || '—'}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono">{shipment.tracking_code || '-'}</span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(shipment.delivery_status)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{shipment.carrier}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDayMonthTimeBR(new Date(shipment.created_at))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                title="Imprimir etiqueta"
                                onClick={() => handlePrintLabel(shipment)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                title="Reimprimir etiqueta (busca fresca nos Correios)"
                                onClick={() => handlePrintLabel(shipment, true)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                title="Imprimir DANFE / Declaração de Conteúdo"
                                onClick={() => handlePrintDanfe(shipment)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Remessas pendentes (erros) */}
        <TabsContent value="pendentes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Remessas pendentes
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {failedCount} remessa(s)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFailed ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : failedCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhuma remessa com erro pendente
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {failedShipments!.map(shipment => {
                      const orderNumber = (shipment.order as any)?.order_number;
                      const customerName = (shipment.order as any)?.customer_name
                        || shipment.pv?.dest_nome
                        || 'Sem cliente vinculado';
                      const headerLabel = orderNumber
                        ? `#${orderNumber}`
                        : shipment.pv?.numero
                          ? `PV ${shipment.pv.numero}`
                          : `Rascunho ${shipment.id.substring(0, 8)}`;
                      return (
                        <div
                          key={shipment.id}
                          className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{headerLabel}</span>
                                {getStatusBadge(shipment.delivery_status)}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {customerName}
                              </p>
                              {(shipment.metadata as any)?.error_message && (
                                <p className="text-xs text-destructive mt-1">
                                  {(shipment.metadata as any).error_message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline" size="sm" className="gap-1"
                                disabled={retryingShipmentId === shipment.id}
                                onClick={() => handleRetryShipment(shipment.id)}
                              >
                                {retryingShipmentId === shipment.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Reenviando...
                                  </>
                                ) : (
                                  <>
                                    <Truck className="h-3 w-3" />
                                    Reenviar
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                onClick={() => openEditDraft(shipment.id)}
                                title="Editar rascunho"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingShipmentId(shipment.id)}
                                title="Excluir rascunho"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t">
                            <Badge variant="outline" className="text-xs">
                              {shipment.carrier}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTimeBR(new Date(shipment.created_at))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dispatch Confirmation Dialog */}
      <Dialog open={!!dispatchDialog} onOpenChange={(open) => !open && setDispatchDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Confirmar Despacho
            </DialogTitle>
          </DialogHeader>
          
          {dispatchDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedido</span>
                  <span className="font-medium">#{dispatchDialog.order?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <span className="text-sm">{dispatchDialog.order?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rastreio</span>
                  <span className="text-sm font-mono">{dispatchDialog.tracking_code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transportadora</span>
                  <span className="text-sm">{dispatchDialog.carrier}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Imprimir documentos:</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" size="sm" className="gap-1 flex-1"
                    onClick={() => handlePrintLabel(dispatchDialog)}
                    disabled={!dispatchDialog.label_url}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Etiqueta
                  </Button>
                  <Button 
                    variant="outline" size="sm" className="gap-1 flex-1"
                    onClick={() => handlePrintDanfe(dispatchDialog)}
                    disabled={!dispatchDialog.invoice_id}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    DANFE
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmDispatch} 
              disabled={isDispatching}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {isDispatching ? 'Despachando...' : 'Confirmar Despacho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DraftShipmentDialog
        open={draftDialogOpen}
        onOpenChange={setDraftDialogOpen}
        shipmentId={editingShipmentId}
        onSaved={invalidateAll}
      />

      <AlertDialog open={!!deletingShipmentId} onOpenChange={(o) => !o && setDeletingShipmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rascunho de remessa?</AlertDialogTitle>
            <AlertDialogDescription>
              O rascunho será removido. Esta ação não toca no pedido nem na NF-e — apenas remove a remessa.
              Se o pedido continuar em aberto, o sistema NÃO vai recriar automaticamente este rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDraft} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
