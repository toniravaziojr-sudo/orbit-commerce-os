import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';
import { useCreateHealthCheckTarget } from '@/hooks/useHealthChecks';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  label: z.string().min(1, 'Nome é obrigatório'),
  storefront_base_url: z.string().url('URL inválida'),
  shops_base_url: z.string().url('URL inválida').optional().or(z.literal('')),
  test_coupon_code: z.string().optional(),
  is_enabled: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface HealthCheckTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthCheckTargetDialog({ open, onOpenChange }: HealthCheckTargetDialogProps) {
  const createTarget = useCreateHealthCheckTarget();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: '',
      storefront_base_url: '',
      shops_base_url: '',
      test_coupon_code: '',
      is_enabled: true,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createTarget.mutateAsync({
        label: values.label,
        storefront_base_url: values.storefront_base_url,
        shops_base_url: values.shops_base_url || null,
        test_coupon_code: values.test_coupon_code || null,
        is_enabled: values.is_enabled,
      });
      toast.success('Alvo criado com sucesso');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao criar alvo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Alvo de Monitoramento</DialogTitle>
          <DialogDescription>
            Configure as URLs que serão verificadas automaticamente pelo Health Monitor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Minha Loja - Produção" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="storefront_base_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Domínio Custom</FormLabel>
                  <FormControl>
                    <Input placeholder="https://loja.exemplo.com.br" {...field} />
                  </FormControl>
                  <FormDescription>
                    A URL base do seu domínio personalizado (sem barra no final)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shops_base_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Domínio Shops (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://minha-loja.shops.comandocentral.com.br" {...field} />
                  </FormControl>
                  <FormDescription>
                    A URL do subdomínio padrão da plataforma
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="test_coupon_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cupom de Teste (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="TESTE10" {...field} />
                  </FormControl>
                  <FormDescription>
                    Cupom válido para testar a funcionalidade de descontos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Habilitado</FormLabel>
                    <FormDescription>
                      Verificar automaticamente este alvo
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTarget.isPending}>
                {createTarget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Alvo
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
