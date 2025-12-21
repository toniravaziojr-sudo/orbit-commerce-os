import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Store, Sparkles } from 'lucide-react';
import { validateSlugFormat, generateSlug } from '@/lib/slugPolicy';

const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  slug: z.string()
    .max(50, 'Slug muito longo')
    .refine(
      (slug) => validateSlugFormat(slug).isValid,
      (slug) => ({ message: validateSlugFormat(slug).error || 'Slug inválido' })
    ),
});

type CreateStoreFormData = z.infer<typeof createStoreSchema>;

export default function CreateStore() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateStoreFormData>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: { name: '', slug: '' },
  });

  // Auto-generate slug from name using centralized policy
  const handleNameChange = (name: string) => {
    const slug = generateSlug(name);
    form.setValue('slug', slug);
  };

  const handleSubmit = async (data: CreateStoreFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar uma loja');
      return;
    }

    setIsLoading(true);
    try {
      // Usar RPC para criar tenant de forma segura (SECURITY DEFINER)
      // A função cria o tenant, user_role e atualiza o profile em uma transação
      const { data: newTenant, error: createError } = await supabase
        .rpc('create_tenant_for_user', {
          p_name: data.name,
          p_slug: data.slug,
        });

      if (createError) {
        // Tratar erro de slug duplicado
        if (createError.message?.includes('Slug already exists')) {
          form.setError('slug', { message: 'Este slug já está em uso. Escolha outro.' });
          setIsLoading(false);
          return;
        }
        throw createError;
      }

      // Provisionar automaticamente o domínio padrão (ativo imediatamente)
      // O tenant retornado pela RPC contém { id, name, slug, ... }
      const tenantId = (newTenant as any)?.id;
      const tenantSlug = data.slug;
      
      if (tenantId && tenantSlug) {
        try {
          const { error: provisionError } = await supabase.functions.invoke('domains-provision-default', {
            body: { tenant_id: tenantId, tenant_slug: tenantSlug }
          });
          
          if (provisionError) {
            console.error('Error provisioning default domain:', provisionError);
            // Não bloquear a criação da loja, apenas logar o erro
          } else {
            console.log('Default platform domain provisioned successfully');
          }
        } catch (domainError) {
          console.error('Error calling domains-provision-default:', domainError);
          // Continuar mesmo se falhar - o usuário pode ativar manualmente depois
        }
      }

      // Atualizar o contexto de autenticação
      await refreshProfile();

      toast.success('Loja criada com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast.error(error.message || 'Erro ao criar loja. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">Central de Comando</span>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Criar sua Loja</CardTitle>
            <CardDescription className="text-base">
              Configure sua loja para começar a usar a plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Loja</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Minha Loja Online"
                          disabled={isLoading}
                          onChange={(e) => {
                            field.onChange(e);
                            handleNameChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        O nome que será exibido para você e sua equipe
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identificador (slug)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="minha-loja-online"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>
                        Identificador único da loja. Use apenas letras minúsculas, números e hífens.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Loja
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
