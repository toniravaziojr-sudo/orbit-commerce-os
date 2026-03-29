// =============================================
// DEFAULT FREE SHIPPING METHOD CONFIG
// Global setting for which shipping method gets free shipping
// =============================================

import { useState, useEffect } from 'react';
import { Save, Loader2, Package, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useAvailableShippingMethods } from '@/hooks/useAvailableShippingMethods';
import { useQueryClient } from '@tanstack/react-query';
import { showErrorToast } from '@/lib/error-toast';

export function DefaultFreeShippingMethodConfig() {
  const { currentTenant } = useAuth();
  const { methods, isLoading: methodsLoading } = useAvailableShippingMethods();
  const queryClient = useQueryClient();
  const [currentMethod, setCurrentMethod] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load current value
  useEffect(() => {
    if (!currentTenant?.id) return;

    const load = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('store_settings')
        .select('default_free_shipping_method')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      setCurrentMethod(data?.default_free_shipping_method || 'none');
      setIsLoading(false);
    };

    load();
  }, [currentTenant?.id]);

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setIsSaving(true);

    try {
      const value = currentMethod === 'none' ? null : currentMethod;

      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ default_free_shipping_method: value })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ tenant_id: currentTenant.id, default_free_shipping_method: value });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast.success('Método padrão de frete grátis salvo!');
    } catch (err: any) {
      showErrorToast(err, { module: 'logística', action: 'salvar' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || methodsLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Método Padrão de Frete Grátis</CardTitle>
        </div>
        <CardDescription>
          Define qual método de envio será gratuito quando o frete grátis for ativado (por produto, cupom ou regra).
          Os demais métodos mantêm preço integral como upgrades pagos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Método de envio gratuito</Label>
          <Select value={currentMethod} onValueChange={setCurrentMethod}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Selecione o método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Todos os métodos (sem restrição)</SelectItem>
              {methods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentMethod !== 'none' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Quando ativo, apenas o método <strong>{currentMethod}</strong> será gratuito.
              Outros métodos (ex: {currentMethod === 'PAC' ? 'SEDEX' : 'PAC'}) continuarão com preço normal.
              Produtos podem sobrescrever essa configuração individualmente no cadastro.
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}