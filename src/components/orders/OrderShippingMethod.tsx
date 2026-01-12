// ============================================
// ORDER SHIPPING METHOD - Intelligent shipping selection for new orders
// Shows integrated carriers (Correios, Frenet, Loggi) with auto-quote
// And manual options (Motoboy, Own Delivery, Store Pickup)
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { Truck, AlertCircle, Loader2, Package, MapPin, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useShippingProviders } from '@/hooks/useShippingProviders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface ShippingOption {
  source_provider: string;
  carrier: string;
  service_code: string;
  service_name: string;
  price: number;
  estimated_days: number;
}

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface ShippingAddress {
  postal_code: string;
  street: string;
  number: string;
  city: string;
  state: string;
}

interface ShippingMethodData {
  shipping_method: string;
  shipping_carrier: string;
  shipping_cost: number;
  shipping_service_code?: string;
  shipping_estimated_days?: number;
}

interface OrderShippingMethodProps {
  address: ShippingAddress;
  items: OrderItem[];
  value: ShippingMethodData;
  onChange: (data: ShippingMethodData) => void;
}

// Manual shipping methods (always available)
const MANUAL_METHODS = [
  { id: 'motoboy', name: 'Motoboy', description: 'Entrega via motoboy' },
  { id: 'proprio', name: 'Entrega Própria', description: 'Entrega com veículo próprio' },
  { id: 'retirada', name: 'Retirada na Loja', description: 'Cliente retira no local' },
];

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  correios: 'Correios',
  frenet: 'Frenet',
  loggi: 'Loggi',
};

export function OrderShippingMethod({ address, items, value, onChange }: OrderShippingMethodProps) {
  const { providers, isLoading: providersLoading } = useShippingProviders();
  
  const [selectedMethodType, setSelectedMethodType] = useState<'integrated' | 'manual' | ''>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // Get enabled providers that support quotes
  const enabledProviders = useMemo(() => {
    return providers.filter(p => p.is_enabled && p.supports_quote);
  }, [providers]);
  
  // Check if address is complete enough for quote
  const isAddressComplete = useMemo(() => {
    return !!(address.postal_code && address.postal_code.replace(/\D/g, '').length >= 8);
  }, [address.postal_code]);
  
  // Calculate shipping when provider is selected and address is ready
  const calculateShipping = async () => {
    if (!selectedProvider || !isAddressComplete) return;
    
    setIsCalculating(true);
    setQuoteError(null);
    setShippingOptions([]);
    
    try {
      // Prepare items for quote
      const quoteItems = items.map(item => ({
        quantity: item.quantity,
        price: item.unit_price,
        weight: 0.5, // Default weight - should come from product
        height: 10,
        width: 15,
        length: 20,
      }));
      
      const cartSubtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      
      const { data, error } = await supabase.functions.invoke('shipping-quote', {
        body: {
          recipient_cep: address.postal_code.replace(/\D/g, ''),
          items: quoteItems,
          cart_subtotal_cents: Math.round(cartSubtotal * 100),
        },
      });
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao calcular frete');
      }
      
      // Filter options by selected provider
      const filteredOptions = (data.options || []).filter((opt: ShippingOption) => 
        opt.source_provider === selectedProvider
      );
      
      if (filteredOptions.length === 0) {
        setQuoteError(`Nenhum serviço disponível para ${PROVIDER_NAMES[selectedProvider] || selectedProvider}`);
      } else {
        setShippingOptions(filteredOptions);
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      setQuoteError('Erro ao calcular frete. Verifique a conexão.');
      toast.error('Erro ao calcular frete');
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Handle provider selection
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedOption('');
    setShippingOptions([]);
    setQuoteError(null);
    
    // If address is ready, calculate automatically
    if (isAddressComplete && items.length > 0) {
      // Calculate after state update
      setTimeout(() => calculateShipping(), 100);
    }
  };
  
  // Trigger calculation when address becomes complete
  useEffect(() => {
    if (selectedMethodType === 'integrated' && selectedProvider && isAddressComplete && items.length > 0 && shippingOptions.length === 0) {
      calculateShipping();
    }
  }, [isAddressComplete, items.length]);
  
  // Handle shipping option selection
  const handleOptionSelect = (optionKey: string) => {
    setSelectedOption(optionKey);
    
    const option = shippingOptions.find(
      opt => `${opt.source_provider}-${opt.service_code}` === optionKey
    );
    
    if (option) {
      onChange({
        shipping_method: option.source_provider,
        shipping_carrier: option.service_name,
        shipping_cost: option.price,
        shipping_service_code: option.service_code,
        shipping_estimated_days: option.estimated_days,
      });
    }
  };
  
  // Handle method type change
  const handleMethodTypeChange = (type: 'integrated' | 'manual') => {
    setSelectedMethodType(type);
    setSelectedProvider('');
    setSelectedOption('');
    setShippingOptions([]);
    setQuoteError(null);
    
    if (type === 'manual') {
      onChange({
        shipping_method: '',
        shipping_carrier: '',
        shipping_cost: 0,
      });
    }
  };
  
  // Handle manual method selection
  const handleManualMethodSelect = (methodId: string) => {
    onChange({
      shipping_method: methodId,
      shipping_carrier: MANUAL_METHODS.find(m => m.id === methodId)?.name || '',
      shipping_cost: methodId === 'retirada' ? 0 : value.shipping_cost,
    });
  };
  
  // Loading state
  if (providersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Método de Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Método de Envio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Method Type Selection */}
        <div className="space-y-2">
          <Label>Tipo de Envio</Label>
          <Select
            value={selectedMethodType}
            onValueChange={(v) => handleMethodTypeChange(v as 'integrated' | 'manual')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de envio" />
            </SelectTrigger>
            <SelectContent>
              {enabledProviders.length > 0 && (
                <SelectItem value="integrated">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Transportadora (cálculo automático)
                  </div>
                </SelectItem>
              )}
              <SelectItem value="manual">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Personalizado (manual)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Integrated Carriers */}
        {selectedMethodType === 'integrated' && (
          <div className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label>Transportadora</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a transportadora" />
                </SelectTrigger>
                <SelectContent>
                  {enabledProviders.map(provider => (
                    <SelectItem key={provider.provider} value={provider.provider}>
                      {PROVIDER_NAMES[provider.provider] || provider.provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Address Warning */}
            {selectedProvider && !isAddressComplete && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  Preencha o <strong>CEP de entrega</strong> completo para calcular o frete automaticamente.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Items Warning */}
            {selectedProvider && isAddressComplete && items.length === 0 && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Adicione produtos ao pedido para calcular o frete.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Calculating */}
            {isCalculating && (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Calculando opções de frete...</span>
              </div>
            )}
            
            {/* Quote Error */}
            {quoteError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{quoteError}</AlertDescription>
              </Alert>
            )}
            
            {/* Shipping Options */}
            {shippingOptions.length > 0 && (
              <div className="space-y-2">
                <Label>Serviços Disponíveis</Label>
                <RadioGroup value={selectedOption} onValueChange={handleOptionSelect}>
                  <div className="space-y-2">
                    {shippingOptions.map(option => {
                      const key = `${option.source_provider}-${option.service_code}`;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedOption === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleOptionSelect(key)}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={key} id={key} />
                            <div>
                              <p className="font-medium">{option.service_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {option.estimated_days > 0 
                                  ? `${option.estimated_days} ${option.estimated_days === 1 ? 'dia útil' : 'dias úteis'}`
                                  : 'Prazo a confirmar'
                                }
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-primary">
                            R$ {option.price.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {/* Recalculate Button */}
            {selectedProvider && isAddressComplete && items.length > 0 && !isCalculating && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={calculateShipping}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Recalcular Frete
              </Button>
            )}
          </div>
        )}
        
        {/* Manual Methods */}
        {selectedMethodType === 'manual' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Método de Envio</Label>
              <Select value={value.shipping_method} onValueChange={handleManualMethodSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o método" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_METHODS.map(method => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {value.shipping_method && value.shipping_method !== 'retirada' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shipping_carrier">Descrição / Transportadora</Label>
                  <Input
                    id="shipping_carrier"
                    value={value.shipping_carrier}
                    onChange={(e) => onChange({ ...value, shipping_carrier: e.target.value })}
                    placeholder="Ex: Motoboy João, Frete Expresso..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping_cost">Custo do Frete (R$)</Label>
                  <Input
                    id="shipping_cost"
                    type="number"
                    min={0}
                    step={0.01}
                    value={value.shipping_cost}
                    onChange={(e) => onChange({ ...value, shipping_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </>
            )}
            
            {value.shipping_method === 'retirada' && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  O cliente irá retirar o pedido na loja. Frete: <strong>Grátis</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* No providers configured warning */}
        {!providersLoading && enabledProviders.length === 0 && !selectedMethodType && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma transportadora integrada configurada. 
              Vá em <strong>Logística → Configurações</strong> para configurar Correios, Frenet ou outras transportadoras.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
