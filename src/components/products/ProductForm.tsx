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
import { Loader2, ArrowLeft, ImageIcon, Link2, Package } from 'lucide-react';
import { ProductImageManager } from './ProductImageManager';
import { RelatedProductsSelect } from './RelatedProductsSelect';
import { ProductStructureEditor } from './ProductStructureEditor';
import { validateSlugFormat, generateSlug as generateSlugFromPolicy, RESERVED_SLUGS } from '@/lib/slugPolicy';

const productSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200),
  sku: z.string().min(1, 'SKU é obrigatório').max(100)
    .transform(val => val.replace(/['"]/g, '').trim()),
  slug: z.string().min(1, 'Slug é obrigatório').max(200)
    .refine(
      (slug) => validateSlugFormat(slug).isValid,
      (slug) => ({ message: validateSlugFormat(slug).error || 'Slug inválido' })
    ),
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
  gtin: z.string().max(50).nullable().optional()
    .transform(val => val ? val.replace(/[^\d]/g, '') : val),
  ncm: z.string().max(20).nullable().optional()
    .transform(val => val ? val.replace(/[^\d]/g, '') : val),
  seo_title: z.string().max(70).nullable().optional(),
  seo_description: z.string().max(160).nullable().optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).default('draft'),
  
  has_variants: z.boolean().default(false),
  product_format: z.enum(['simple', 'with_variants', 'with_composition']).default('simple'),
  stock_type: z.enum(['physical', 'virtual']).default('physical'),
  
  // New canonical fields
  brand: z.string().max(100).nullable().optional(),
  vendor: z.string().max(100).nullable().optional(),
  product_type: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  requires_shipping: z.boolean().nullable().optional(),
  taxable: z.boolean().nullable().optional(),
  tax_code: z.string().max(50).nullable().optional(),
  cest: z.string().max(20).nullable().optional()
    .transform(val => val ? val.replace(/[^\d]/g, '') : val),
  origin_code: z.string().max(10).nullable().optional(),
  uom: z.string().max(20).nullable().optional(),
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
      
      has_variants: product?.has_variants ?? false,
      product_format: product?.product_format ?? 'simple',
      stock_type: product?.stock_type ?? 'physical',
      
      // New canonical fields
      brand: product?.brand ?? '',
      vendor: product?.vendor ?? '',
      product_type: product?.product_type ?? '',
      tags: product?.tags ?? [],
      requires_shipping: product?.requires_shipping ?? true,
      taxable: product?.taxable ?? true,
      tax_code: product?.tax_code ?? '',
      cest: product?.cest ?? '',
      origin_code: product?.origin_code ?? '',
      uom: product?.uom ?? '',
    },
  });

  const isLoading = createProduct.isPending || updateProduct.isPending;

  // Use centralized slug generation from slugPolicy
  const generateSlug = generateSlugFromPolicy;

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
          is_featured: false,
          has_variants: data.has_variants,
          product_format: data.product_format,
          stock_type: data.stock_type,
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
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="images">
                <ImageIcon className="h-4 w-4 mr-1" />
                Imagens
              </TabsTrigger>
              <TabsTrigger value="pricing">Preços</TabsTrigger>
              <TabsTrigger value="inventory">Estoque</TabsTrigger>
              <TabsTrigger 
                value="structure" 
                disabled={form.watch('product_format') !== 'with_composition'}
                title={form.watch('product_format') !== 'with_composition' ? 'Selecione "Com composição (Kit)" no formato para habilitar' : ''}
              >
                <Package className="h-4 w-4 mr-1" />
                Estrutura
              </TabsTrigger>
              <TabsTrigger value="related">
                <Link2 className="h-4 w-4 mr-1" />
                Relacionados
              </TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="advanced">Avançado</TabsTrigger>
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
                            <Input 
                              {...field} 
                              placeholder="Ex: CAM-BAS-001"
                              onChange={(e) => {
                                // Remove special chars like quotes
                                const cleaned = e.target.value.replace(/['"]/g, '');
                                field.onChange(cleaned);
                              }}
                            />
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

                  <div className="grid gap-4 md:grid-cols-3">
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
                      name="product_format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Formato do Produto</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o formato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="simple">Simples</SelectItem>
                              <SelectItem value="with_variants">Com variações</SelectItem>
                              <SelectItem value="with_composition">Com composição (Kit)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {field.value === 'with_composition' 
                              ? 'Configure os componentes na aba "Estrutura"' 
                              : field.value === 'with_variants'
                              ? 'Produto com variações de cor, tamanho, etc.'
                              : 'Produto simples sem variações'}
                          </FormDescription>
                          <FormMessage />
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
                            <Input 
                              {...field} 
                              value={field.value ?? ''} 
                              placeholder="Apenas números"
                              inputMode="numeric"
                              onChange={(e) => {
                                // Allow only numbers
                                const cleaned = e.target.value.replace(/[^\d]/g, '');
                                field.onChange(cleaned);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Código de barras internacional do produto (apenas números)
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
                            <Input 
                              {...field} 
                              value={field.value ?? ''} 
                              placeholder="Apenas números"
                              inputMode="numeric"
                              onChange={(e) => {
                                // Allow only numbers
                                const cleaned = e.target.value.replace(/[^\d]/g, '');
                                field.onChange(cleaned);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Nomenclatura Comum do Mercosul (apenas números)
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
                    <div className="text-center py-12 border-2 border-dashed rounded-lg space-y-4">
                      <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/40" />
                      <div>
                        <p className="text-lg font-medium">Salve o produto primeiro</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          Para adicionar imagens, primeiro salve o produto clicando em "Criar Produto"
                        </p>
                      </div>
                    </div>
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

            <TabsContent value="structure" className="space-y-4 mt-4">
              {form.watch('product_format') === 'with_composition' ? (
                isEditing && product ? (
                  <ProductStructureEditor
                    productId={product.id}
                    stockType={form.watch('stock_type')}
                    onStockTypeChange={(type) => form.setValue('stock_type', type)}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Estrutura do Kit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-lg font-medium">Salve o produto primeiro</p>
                        <p className="text-muted-foreground text-sm mt-1">
                          Para configurar os componentes do kit, primeiro salve o produto
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Estrutura do Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                      <p className="text-muted-foreground">
                        Selecione o formato "<strong>Com composição (Kit)</strong>" na aba Básico para habilitar a configuração de componentes
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="related" className="space-y-4 mt-4">
              {isEditing && product ? (
                <RelatedProductsSelect productId={product.id} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Produtos Relacionados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <Link2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                      <p className="text-lg font-medium">Salve o produto primeiro</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Para adicionar produtos relacionados, primeiro salve o produto
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
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

            {/* Advanced Tab - New Canonical Fields */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Marca e Fornecedor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Ex: Nike"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fornecedor</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Ex: Distribuidora XYZ"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="product_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Produto</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Ex: Calçados"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informações Fiscais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="cest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEST</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              placeholder="0000000"
                              inputMode="numeric"
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^\d]/g, '');
                                field.onChange(cleaned);
                              }}
                            />
                          </FormControl>
                          <FormDescription>Código Especificador da Substituição Tributária</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="origin_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem Fiscal</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">0 - Nacional</SelectItem>
                              <SelectItem value="1">1 - Estrangeira (import. direta)</SelectItem>
                              <SelectItem value="2">2 - Estrangeira (merc. interno)</SelectItem>
                              <SelectItem value="3">3 - Nacional (import. 40-70%)</SelectItem>
                              <SelectItem value="4">4 - Nacional (processos básicos)</SelectItem>
                              <SelectItem value="5">5 - Nacional (import. &lt;40%)</SelectItem>
                              <SelectItem value="6">6 - Estrangeira (sem similar)</SelectItem>
                              <SelectItem value="7">7 - Estrangeira (similar, merc. int.)</SelectItem>
                              <SelectItem value="8">8 - Nacional (import. &gt;70%)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade de Medida</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UN">UN - Unidade</SelectItem>
                              <SelectItem value="PC">PC - Peça</SelectItem>
                              <SelectItem value="CX">CX - Caixa</SelectItem>
                              <SelectItem value="KG">KG - Quilograma</SelectItem>
                              <SelectItem value="G">G - Grama</SelectItem>
                              <SelectItem value="L">L - Litro</SelectItem>
                              <SelectItem value="ML">ML - Mililitro</SelectItem>
                              <SelectItem value="M">M - Metro</SelectItem>
                              <SelectItem value="M2">M2 - Metro Quadrado</SelectItem>
                              <SelectItem value="M3">M3 - Metro Cúbico</SelectItem>
                              <SelectItem value="PAR">PAR - Par</SelectItem>
                              <SelectItem value="DZ">DZ - Dúzia</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="taxable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Produto Tributável</FormLabel>
                            <FormDescription>
                              Este produto está sujeito a impostos
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requires_shipping"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Requer Frete</FormLabel>
                            <FormDescription>
                              Este produto precisa de envio físico
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tax_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Tributário</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Código específico de tributação"
                          />
                        </FormControl>
                        <FormDescription>Código adicional para integração fiscal</FormDescription>
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
