import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Product, useProducts, useCategories } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, ImageIcon } from 'lucide-react';
import { ProductImageManager } from './ProductImageManager';

const productSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200),
  sku: z.string().min(1, 'SKU é obrigatório').max(100),
  slug: z.string().min(2, 'Slug deve ter no mínimo 2 caracteres').max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().max(10000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  price: z.coerce.number().min(0, 'Preço deve ser maior que zero'),
  compare_at_price: z.coerce.number().min(0).nullable().optional(),
  promotion_start_date: z.string().nullable().optional(),
  promotion_end_date: z.string().nullable().optional(),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  manage_stock: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  weight: z.coerce.number().min(0).nullable().optional(),
  width: z.coerce.number().min(0).nullable().optional(),
  height: z.coerce.number().min(0).nullable().optional(),
  depth: z.coerce.number().min(0).nullable().optional(),
  gtin: z.string().max(50).nullable().optional(),
  ncm: z.string().max(20).nullable().optional(),
  seo_title: z.string().max(70).nullable().optional(),
  seo_description: z.string().max(160).nullable().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  is_featured: z.boolean().default(false),
  has_variants: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormProps {
  product?: Product | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
}

export function ProductForm({ product, onCancel, onSuccess }: ProductFormProps) {
  const { createProduct, updateProduct } = useProducts();
  const { categories } = useCategories();
  const isEditing = !!product;
  const [productImages, setProductImages] = useState<ProductImage[]>([]);

  // Load product images
  useEffect(() => {
    if (product?.id) {
      loadProductImages();
    }
  }, [product?.id]);

  const loadProductImages = async () => {
    if (!product?.id) return;
    
    const { data, error } = await supabase
      .from('product_images')
      .select('id, url, alt_text, is_primary, sort_order')
      .eq('product_id', product.id)
      .order('sort_order');

    if (!error && data) {
      setProductImages(data);
    }
  };

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      slug: product?.slug ?? '',
      description: product?.description ?? '',
      short_description: product?.short_description ?? '',
      cost_price: product?.cost_price ?? null,
      price: product?.price ?? 0,
      compare_at_price: product?.compare_at_price ?? null,
      promotion_start_date: product?.promotion_start_date ?? null,
      promotion_end_date: product?.promotion_end_date ?? null,
      stock_quantity: product?.stock_quantity ?? 0,
      low_stock_threshold: product?.low_stock_threshold ?? 5,
      manage_stock: product?.manage_stock ?? true,
      allow_backorder: product?.allow_backorder ?? false,
      weight: product?.weight ?? null,
      width: product?.width ?? null,
      height: product?.height ?? null,
      depth: product?.depth ?? null,
      gtin: product?.gtin ?? product?.barcode ?? '',
      ncm: product?.ncm ?? '',
      seo_title: product?.seo_title ?? '',
      seo_description: product?.seo_description ?? '',
      status: product?.status ?? 'draft',
      is_featured: product?.is_featured ?? false,
      has_variants: product?.has_variants ?? false,
    },
  });

  const isLoading = createProduct.isPending || updateProduct.isPending;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    form.setValue('name', name);
    if (!isEditing && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(name));
    }
  };

  const handleSubmit = async (data: ProductFormData) => {
    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, ...data });
      } else {
        await createProduct.mutateAsync({
          sku: data.sku,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          short_description: data.short_description ?? null,
          cost_price: data.cost_price ?? null,
          price: data.price,
          compare_at_price: data.compare_at_price ?? null,
          promotion_start_date: data.promotion_start_date ?? null,
          promotion_end_date: data.promotion_end_date ?? null,
          stock_quantity: data.stock_quantity,
          low_stock_threshold: data.low_stock_threshold,
          manage_stock: data.manage_stock,
          allow_backorder: data.allow_backorder,
          weight: data.weight ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          depth: data.depth ?? null,
          barcode: null,
          gtin: data.gtin ?? null,
          ncm: data.ncm ?? null,
          seo_title: data.seo_title ?? null,
          seo_description: data.seo_description ?? null,
          status: data.status,
          is_featured: data.is_featured,
          has_variants: data.has_variants,
        });
      }
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Atualize as informações do produto'
              : 'Preencha os dados do novo produto'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="images" disabled={!isEditing}>
                <ImageIcon className="h-4 w-4 mr-1" />
                Imagens
              </TabsTrigger>
              <TabsTrigger value="pricing">Preços</TabsTrigger>
              <TabsTrigger value="inventory">Estoque</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Produto *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) => handleNameChange(e.target.value)}
                              placeholder="Ex: Camiseta Básica"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: CAM-BAS-001" />
                          </FormControl>
                          <FormDescription>Código único do produto</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="camiseta-basica" />
                        </FormControl>
                        <FormDescription>
                          URL amigável do produto (gerado automaticamente)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Curta</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Breve descrição do produto..."
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição Completa</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Descrição detalhada do produto..."
                            rows={5}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Rascunho</SelectItem>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                              <SelectItem value="archived">Arquivado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_featured"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Destaque</FormLabel>
                            <FormDescription>
                              Exibir produto em destaque
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
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informações Físicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso (kg)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.001"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="width"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Largura (cm)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Altura (cm)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="depth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profundidade (cm)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="gtin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GTIN/EAN (Código de Barras)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormDescription>
                            Código de barras internacional do produto
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ncm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NCM</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormDescription>
                            Nomenclatura Comum do Mercosul
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Imagens do Produto</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing && product ? (
                    <ProductImageManager
                      productId={product.id}
                      images={productImages}
                      onImagesChange={loadProductImages}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Salve o produto primeiro para adicionar imagens
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Precificação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="cost_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço de Custo</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="0,00"
                            />
                          </FormControl>
                          <FormDescription>Custo de aquisição</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço de Venda *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0,00"
                            />
                          </FormControl>
                          <FormDescription>Preço atual</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="compare_at_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Original</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="0,00"
                            />
                          </FormControl>
                          <FormDescription>Exibido riscado</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="promotion_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Início da Promoção</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="datetime-local"
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="promotion_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fim da Promoção</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="datetime-local"
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Controle de Estoque</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="manage_stock"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Gerenciar Estoque</FormLabel>
                          <FormDescription>
                            Controlar quantidade disponível do produto
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

                  {form.watch('manage_stock') && (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="stock_quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantidade em Estoque</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="low_stock_threshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alerta de Estoque Baixo</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" />
                              </FormControl>
                              <FormDescription>
                                Notificar quando atingir esta quantidade
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="allow_backorder"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Permitir Venda sem Estoque
                              </FormLabel>
                              <FormDescription>
                                Aceitar pedidos mesmo com estoque zerado
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
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO e Mecanismos de Busca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="seo_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título SEO</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Título para mecanismos de busca"
                            maxLength={70}
                          />
                        </FormControl>
                        <FormDescription>
                          {(field.value?.length ?? 0)}/70 caracteres
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seo_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Descrição para resultados de busca"
                            rows={3}
                            maxLength={160}
                          />
                        </FormControl>
                        <FormDescription>
                          {(field.value?.length ?? 0)}/160 caracteres
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Criar Produto'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
