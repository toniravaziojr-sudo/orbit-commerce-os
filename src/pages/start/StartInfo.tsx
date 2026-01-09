import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  email: z.string().email('E-mail inválido'),
  owner_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  store_name: z.string().min(2, 'Nome da loja deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
  terms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
});

type FormData = z.infer<typeof formSchema>;

export default function StartInfo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const planKey = searchParams.get('plan') || 'start';
  const cycle = (searchParams.get('cycle') as 'monthly' | 'annual') || 'monthly';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      owner_name: '',
      store_name: '',
      phone: '',
      terms: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      const response = await supabase.functions.invoke('start-create-checkout', {
        body: {
          plan_key: planKey,
          cycle: cycle,
          email: data.email,
          owner_name: data.owner_name,
          store_name: data.store_name,
          phone: data.phone || undefined,
          utm: Object.fromEntries(
            Array.from(searchParams.entries()).filter(([key]) => key.startsWith('utm_'))
          ),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar checkout');
      }

      // Redirecionar para o Mercado Pago
      if (result.init_point) {
        window.location.href = result.init_point;
      } else {
        throw new Error('URL de pagamento não recebida');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível iniciar o checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/start?plan=${planKey}&cycle=${cycle}`)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Seus dados</CardTitle>
            <CardDescription>
              Preencha os dados para continuar com o pagamento
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu nome</FormLabel>
                      <FormControl>
                        <Input placeholder="João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="store_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da sua loja</FormLabel>
                      <FormControl>
                        <Input placeholder="Minha Loja" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Li e aceito os{' '}
                          <a href="/termos" target="_blank" className="text-primary underline">
                            termos de uso
                          </a>{' '}
                          e a{' '}
                          <a href="/privacidade" target="_blank" className="text-primary underline">
                            política de privacidade
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Ir para pagamento'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Pagamento seguro via Mercado Pago
        </p>
      </div>
    </div>
  );
}
