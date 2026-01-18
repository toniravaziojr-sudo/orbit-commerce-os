// =============================================
// PAYMENT METHODS CONFIG - Compact drag-and-drop reorder + custom labels
// For builder PageSettingsContent (checkout page)
// =============================================

import { useState, useEffect } from 'react';
import { GripVertical, CreditCard, QrCode, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  PaymentMethod,
  PaymentMethodCustomLabels,
  defaultCheckoutConfig,
  parseCheckoutConfig,
  CheckoutConfig,
} from '@/lib/storeConfigTypes';
import { Json } from '@/integrations/supabase/types';

const PAYMENT_METHOD_INFO: Record<PaymentMethod, { label: string; icon: React.ReactNode; description: string }> = {
  pix: { 
    label: 'PIX', 
    icon: <QrCode className="h-4 w-4 text-emerald-600" />,
    description: 'Pagamento instantâneo'
  },
  credit_card: { 
    label: 'Cartão de Crédito', 
    icon: <CreditCard className="h-4 w-4 text-blue-600" />,
    description: 'Parcelado ou à vista'
  },
  boleto: { 
    label: 'Boleto Bancário', 
    icon: <FileText className="h-4 w-4 text-gray-600" />,
    description: 'Vencimento em 3 dias'
  },
};

interface PaymentMethodsConfigProps {
  tenantId: string;
}

export function PaymentMethodsConfig({ tenantId }: PaymentMethodsConfigProps) {
  const queryClient = useQueryClient();
  const [methodsOrder, setMethodsOrder] = useState<PaymentMethod[]>(defaultCheckoutConfig.paymentMethodsOrder);
  const [customLabels, setCustomLabels] = useState<PaymentMethodCustomLabels>({});
  const [draggedMethod, setDraggedMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load current config
  useEffect(() => {
    async function loadConfig() {
      if (!tenantId) return;
      
      try {
        const { data } = await supabase
          .from('store_settings')
          .select('checkout_config')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        
        const config = parseCheckoutConfig(data?.checkout_config);
        setMethodsOrder(config.paymentMethodsOrder);
        setCustomLabels(config.paymentMethodLabels || {});
      } catch (error) {
        console.error('Error loading checkout config:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadConfig();
  }, [tenantId]);

  // Save config with debounce
  const saveConfig = async (newOrder: PaymentMethod[], newLabels: PaymentMethodCustomLabels) => {
    if (!tenantId) return;
    
    setIsSaving(true);
    
    try {
      // Get current config to merge
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id, checkout_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      const currentConfig = parseCheckoutConfig(existing?.checkout_config);
      const updatedConfig: CheckoutConfig = {
        ...currentConfig,
        paymentMethodsOrder: newOrder,
        paymentMethodLabels: newLabels,
      };
      
      if (existing?.id) {
        await supabase
          .from('store_settings')
          .update({ checkout_config: updatedConfig as unknown as Json })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: tenantId, 
            checkout_config: updatedConfig as unknown as Json 
          });
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['store-config', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['checkout-config', tenantId] });
      
    } catch (error) {
      console.error('Error saving checkout config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  // Drag handlers
  const handleDragStart = (method: PaymentMethod) => {
    setDraggedMethod(method);
  };

  const handleDragOver = (e: React.DragEvent, targetMethod: PaymentMethod) => {
    e.preventDefault();
    if (!draggedMethod || draggedMethod === targetMethod) return;
    
    const newOrder = [...methodsOrder];
    const draggedIndex = newOrder.indexOf(draggedMethod);
    const targetIndex = newOrder.indexOf(targetMethod);
    
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedMethod);
    
    setMethodsOrder(newOrder);
  };

  const handleDragEnd = () => {
    if (draggedMethod) {
      saveConfig(methodsOrder, customLabels);
    }
    setDraggedMethod(null);
  };

  // Label change handler
  const handleLabelChange = (method: PaymentMethod, value: string) => {
    const newLabels = { ...customLabels };
    if (value.trim()) {
      newLabels[method] = value;
    } else {
      delete newLabels[method];
    }
    setCustomLabels(newLabels);
    saveConfig(methodsOrder, newLabels);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Formas de Pagamento
        </Label>
        {isSaving && (
          <span className="text-[10px] text-muted-foreground">Salvando...</span>
        )}
      </div>
      
      <p className="text-[10px] text-muted-foreground">
        Arraste para reordenar. Use os campos para adicionar badges (ex: "5% OFF").
      </p>
      
      <div className="space-y-2">
        {methodsOrder.map((method, index) => {
          const info = PAYMENT_METHOD_INFO[method];
          
          return (
            <div key={method} className="space-y-1.5">
              {/* Draggable row */}
              <div
                draggable
                onDragStart={() => handleDragStart(method)}
                onDragOver={(e) => handleDragOver(e, method)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border bg-card cursor-move",
                  "hover:bg-muted/50 transition-colors",
                  draggedMethod === method && "opacity-50 border-primary"
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground w-4">{index + 1}.</span>
                {info.icon}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate">{info.label}</span>
                </div>
                {customLabels[method] && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full truncate max-w-[80px]">
                    {customLabels[method]}
                  </span>
                )}
              </div>
              
              {/* Label input */}
              <div className="pl-6">
                <Input
                  placeholder="Badge opcional (ex: 5% OFF)"
                  value={customLabels[method] || ''}
                  onChange={(e) => handleLabelChange(method, e.target.value)}
                  className="h-7 text-[11px]"
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-[10px] text-muted-foreground text-center pt-1">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente'}
      </p>
    </div>
  );
}
