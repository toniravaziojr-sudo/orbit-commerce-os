// =============================================
// FREE SHIPPING RULE DIALOG
// Dialog for creating/editing free shipping rules
// =============================================

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { type ShippingFreeRule, normalizeCep } from '@/hooks/useShippingRules';

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  region_type: z.enum(['capital', 'interior']),
  cep_start: z.string().min(8, 'CEP inicial inválido').max(9),
  cep_end: z.string().min(8, 'CEP final inválido').max(9),
  uf: z.string().nullable(),
  min_order_cents: z.number().nullable(),
  delivery_days_min: z.number().min(0).nullable(),
  delivery_days_max: z.number().min(0).nullable(),
  is_enabled: z.boolean(),
  sort_order: z.number().min(0),
}).refine((data) => {
  const start = parseInt(normalizeCep(data.cep_start));
  const end = parseInt(normalizeCep(data.cep_end));
  return start <= end;
}, {
  message: 'CEP inicial deve ser menor ou igual ao CEP final',
  path: ['cep_end'],
});

type FormValues = z.infer<typeof formSchema>;

interface FreeShippingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: ShippingFreeRule | null;
  onSave: (data: Omit<ShippingFreeRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => void;
  isLoading?: boolean;
}

export function FreeShippingRuleDialog({
  open,
  onOpenChange,
  rule,
  onSave,
  isLoading,
}: FreeShippingRuleDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      region_type: 'capital',
      cep_start: '',
      cep_end: '',
      uf: null,
      min_order_cents: null,
      delivery_days_min: null,
      delivery_days_max: null,
      is_enabled: true,
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (rule) {
      form.reset({
        name: rule.name,
        region_type: rule.region_type,
        cep_start: rule.cep_start,
        cep_end: rule.cep_end,
        uf: rule.uf,
        min_order_cents: rule.min_order_cents,
        delivery_days_min: rule.delivery_days_min,
        delivery_days_max: rule.delivery_days_max,
        is_enabled: rule.is_enabled,
        sort_order: rule.sort_order,
      });
    } else {
      form.reset({
        name: '',
        region_type: 'capital',
        cep_start: '',
        cep_end: '',
        uf: null,
        min_order_cents: null,
        delivery_days_min: null,
        delivery_days_max: null,
        is_enabled: true,
        sort_order: 0,
      });
    }
  }, [rule, form, open]);

  const handleSubmit = (values: FormValues) => {
    onSave({
      name: values.name,
      region_type: values.region_type,
      cep_start: values.cep_start,
      cep_end: values.cep_end,
      uf: values.uf,
      min_order_cents: values.min_order_cents,
      delivery_days_min: values.delivery_days_min,
      delivery_days_max: values.delivery_days_max,
      is_enabled: values.is_enabled,
      sort_order: values.sort_order,
    });
  };

  const formatCepInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Editar Regra de Frete Grátis' : 'Nova Regra de Frete Grátis'}
          </DialogTitle>
          <DialogDescription>
            Configure uma regra de frete grátis por região e faixa de CEP
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Regra</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Frete Grátis Capital SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="region_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Região</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="capital">Capital</SelectItem>
                      <SelectItem value="interior">Interior</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cep_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP Inicial</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00000-000" 
                        {...field}
                        onChange={(e) => field.onChange(formatCepInput(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cep_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP Final</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="99999-999" 
                        {...field}
                        onChange={(e) => field.onChange(formatCepInput(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="uf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UF (opcional)</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(val === 'none' ? null : val)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a UF" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Todas</SelectItem>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Filtra adicionalmente por estado, se preenchido
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="min_order_cents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Mínimo do Pedido (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="Ex: 199.90"
                      value={field.value ? (field.value / 100).toFixed(2) : ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        field.onChange(isNaN(value) ? null : Math.round(value * 100));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Frete grátis só aplica se o pedido for maior ou igual a este valor
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="delivery_days_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo Mínimo (dias)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min={0}
                        placeholder="Ex: 3"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(isNaN(value) ? null : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_days_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo Máximo (dias)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        min={0}
                        placeholder="Ex: 7"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(isNaN(value) ? null : value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Regras com menor número têm prioridade quando há sobreposição
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Regra Ativa</FormLabel>
                    <FormDescription>
                      Desative para pausar esta regra temporariamente
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {rule ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
