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

const createStoreSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  slug: z.string()
    .min(2, 'Slug deve ter no mínimo 2 caracteres')
    .max(50, 'Slug muito longo')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
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

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .trim();
    
    form.setValue('slug', slug);
  };

  const handleSubmit = async (data: CreateStoreFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar uma loja');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verificar se o slug já existe
      const { data: existingTenant, error: checkError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', data.slug)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingTenant) {
        form.setError('slug', { message: 'Este slug já está em uso. Escolha outro.' });
        setIsLoading(false);
        return;
      }

      // 2. Criar o tenant
      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // 3. Criar role de owner para o usuário
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          tenant_id: newTenant.id,
          role: 'owner',
        });

      if (roleError) {
        // Rollback: deletar o tenant criado
        await supabase.from('tenants').delete().eq('id', newTenant.id);
        throw roleError;
      }

      // 4. Atualizar o current_tenant_id do perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_tenant_id: newTenant.id })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating current tenant:', profileError);
      }

      // 5. Atualizar o contexto de autenticação
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
