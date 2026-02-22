import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Product, useProducts, useCategories } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ProductRichTextEditor } from './ProductRichTextEditor';
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
import { Loader2, ArrowLeft, ImageIcon, Link2, Package, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductImageManager } from './ProductImageManager';
import { ProductImageUploader, type PendingImage } from './ProductImageUploader';
import { RelatedProductsSelect } from './RelatedProductsSelect';
import { RelatedProductsPicker } from './RelatedProductsPicker';
import { ProductStructureEditor } from './ProductStructureEditor';
import { ProductComponentsPicker, type PendingComponent } from './ProductComponentsPicker';
import { ProductVariantPicker, type PendingVariant } from './ProductVariantPicker';
import { validateSlugFormat, generateSlug as generateSlugFromPolicy, RESERVED_SLUGS } from '@/lib/slugPolicy';
import { useToast } from '@/hooks/use-toast';
import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
import { AIDescriptionButton } from './AIDescriptionButton';

const productSchema = z.object({
  // === CAMPOS OBRIGATÓRIOS BÁSICOS ===
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200),
  sku: z.string().min(1, 'SKU é obrigatório').max(100)
    .transform(val => val.replace(/['"]/g, '').trim()),
  slug: z.string().min(1, 'Slug é obrigatório').max(200)
    .refine(
      (slug) => validateSlugFormat(slug).isValid,
      (slug) => ({ message: validateSlugFormat(slug).error || 'Slug inválido' })
    ),
  price: z.coerce.number().min(0.01, 'Preço deve ser maior que zero'),
  
  // === CAMPOS OBRIGATÓRIOS PARA FRETE ===
  weight: z.coerce.number({ required_error: 'Peso é obrigatório para cálculo de frete' })
    .min(0.001, 'Peso deve ser maior que 0 (obrigatório para frete)'),
  width: z.coerce.number({ required_error: 'Largura é obrigatória para cálculo de frete' })
    .min(0.1, 'Largura deve ser maior que 0 (obrigatória para frete)'),
  height: z.coerce.number({ required_error: 'Altura é obrigatória para cálculo de frete' })
    .min(0.1, 'Altura deve ser maior que 0 (obrigatória para frete)'),
  depth: z.coerce.number({ required_error: 'Profundidade é obrigatória para cálculo de frete' })
    .min(0.1, 'Profundidade deve ser maior que 0 (obrigatória para frete)'),
  
  // === CAMPOS OBRIGATÓRIOS PARA NF-e ===
  ncm: z.string()
    .min(8, 'NCM deve ter 8 dígitos (obrigatório para NF-e)')
    .max(8, 'NCM deve ter exatamente 8 dígitos')
    .transform(val => val.replace(/[^\d]/g, '')),
  
  // === CAMPOS OPCIONAIS ===
  description: z.string().max(10000).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  compare_at_price: z.coerce.number().min(0).nullable().optional(),
  promotion_start_date: z.string().nullable().optional(),
  promotion_end_date: z.string().nullable().optional(),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  manage_stock: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  gtin: z.string().max(50).nullable().optional()
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
  const { toast } = useToast();
  const isEditing = !!product;
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  
  // State for new product creation - local data until saved
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingRelatedIds, setPendingRelatedIds] = useState<string[]>([]);
  const [pendingComponents, setPendingComponents] = useState<PendingComponent[]>([]);
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [componentsLoaded, setComponentsLoaded] = useState(!product?.id); // true if new product, false if editing (will be set true after loading)
  const [hasSavedComponents, setHasSavedComponents] = useState(false); // Track if editing product has components in DB

  // Load product data for editing
  useEffect(() => {
    if (product?.id) {
      loadProductImages();
      loadRelatedProducts();
      loadComponents();
      loadVariants();
    }
  }, [product?.id]);

  const loadVariants = async () => {
    if (!product?.id) return;
    
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('position');

    if (data) {
      setPendingVariants(data.map(v => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        option1_name: v.option1_name || '',
        option1_value: v.option1_value || '',
        option2_name: v.option2_name || '',
        option2_value: v.option2_value || '',
        option3_name: v.option3_name || '',
        option3_value: v.option3_value || '',
        price: v.price,
        compare_at_price: v.compare_at_price,
        cost_price: v.cost_price,
        stock_quantity: v.stock_quantity || 0,
        weight: v.weight,
        gtin: v.gtin || '',
        is_active: v.is_active ?? true,
        image_url: v.image_url,
      })));
    }
  };

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

  const loadRelatedProducts = async () => {
    if (!product?.id) return;
    
    const { data } = await supabase
      .from('related_products')
      .select('related_product_id')
      .eq('product_id', product.id)
      .order('position');

    if (data) {
      setPendingRelatedIds(data.map(r => r.related_product_id));
    }
  };

  const loadComponents = async () => {
    if (!product?.id) {
      setComponentsLoaded(true);
      return;
    }
    
    const { data } = await supabase
      .from('product_components')
      .select(`
        id,
        component_product_id,
        quantity,
        cost_price,
        sale_price,
        sort_order,
        component:products!product_components_component_product_id_fkey(
          id, name, sku, price, cost_price, stock_quantity
        )
      `)
      .eq('parent_product_id', product.id)
      .order('sort_order');

    if (data) {
      setPendingComponents(data.map(c => ({
        ...c,
        component: c.component as any,
      })));
      setHasSavedComponents(data.length > 0);
    } else {
      setHasSavedComponents(false);
    }
    setComponentsLoaded(true);
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
      weight: product?.weight ?? undefined,
      width: product?.width ?? undefined,
      height: product?.height ?? undefined,
      depth: product?.depth ?? undefined,
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

  const isLoading = createProduct.isPending || updateProduct.isPending || isSaving;

  // Use centralized slug generation from slugPolicy
  const generateSlug = generateSlugFromPolicy;

  const handleNameChange = (name: string) => {
    form.setValue('name', name);
    if (!isEditing && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(name));
    }
  };

  // Upload pending images to storage and return URLs
  const uploadPendingImages = async (productId: string): Promise<void> => {
    for (const image of pendingImages) {
      try {
        let imageUrl = image.url;

        // If it's a file, upload to storage
        if (image.type === 'file' && image.file) {
          const fileExt = image.file.name.split('.').pop();
          const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, image.file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

          imageUrl = publicUrl;
        }

        // Insert image record
        await supabase.from('product_images').insert({
          product_id: productId,
          url: imageUrl,
          alt_text: image.alt_text,
          is_primary: image.is_primary,
          sort_order: image.sort_order,
        });
      } catch (error) {
        console.error('Error saving image:', error);
      }
    }
  };

  // Save related products
  const saveRelatedProducts = async (productId: string): Promise<void> => {
    if (pendingRelatedIds.length === 0) return;

    const relations = pendingRelatedIds.map((relatedId, index) => ({
      product_id: productId,
      related_product_id: relatedId,
      position: index,
    }));

    await supabase.from('related_products').insert(relations);
  };

  // Save product components (for kits)
  const saveComponents = async (productId: string): Promise<void> => {
    if (pendingComponents.length === 0) return;

    const components = pendingComponents.map((comp, index) => ({
      parent_product_id: productId,
      component_product_id: comp.component_product_id,
      quantity: comp.quantity,
      cost_price: comp.cost_price,
      sale_price: comp.sale_price,
      sort_order: index,
    }));

    await supabase.from('product_components').insert(components);
  };

  // Update related products for editing
  const updateRelatedProducts = async (productId: string): Promise<void> => {
    // Delete existing
    await supabase.from('related_products').delete().eq('product_id', productId);
    
    // Insert new
    if (pendingRelatedIds.length > 0) {
      const relations = pendingRelatedIds.map((relatedId, index) => ({
        product_id: productId,
        related_product_id: relatedId,
        position: index,
      }));
      await supabase.from('related_products').insert(relations);
    }
  };

  // Update components for editing
  const updateComponents = async (productId: string): Promise<void> => {
    // Delete existing
    await supabase.from('product_components').delete().eq('parent_product_id', productId);
    
    // Insert new
    if (pendingComponents.length > 0) {
      const components = pendingComponents.map((comp, index) => ({
        parent_product_id: productId,
        component_product_id: comp.component_product_id,
        quantity: comp.quantity,
        cost_price: comp.cost_price,
        sale_price: comp.sale_price,
        sort_order: index,
      }));
      await supabase.from('product_components').insert(components);
    }
  };

  // Save variants for new product
  const saveVariants = async (productId: string): Promise<void> => {
    if (pendingVariants.length === 0) return;

    for (let i = 0; i < pendingVariants.length; i++) {
      const variant = pendingVariants[i];
      let imageUrl = variant.image_url;

      // Upload image if it's a file
      if (variant.image_file) {
        const fileExt = variant.image_file.name.split('.').pop();
        const fileName = `${productId}/variants/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, variant.image_file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      await supabase.from('product_variants').insert({
        product_id: productId,
        sku: variant.sku,
        name: variant.name,
        option1_name: variant.option1_name || null,
        option1_value: variant.option1_value || null,
        option2_name: variant.option2_name || null,
        option2_value: variant.option2_value || null,
        option3_name: variant.option3_name || null,
        option3_value: variant.option3_value || null,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        cost_price: variant.cost_price,
        stock_quantity: variant.stock_quantity,
        weight: variant.weight,
        gtin: variant.gtin || null,
        is_active: variant.is_active,
        image_url: imageUrl,
        position: i,
      });
    }
  };

  // Update variants for editing
  const updateVariants = async (productId: string): Promise<void> => {
    // Delete existing variants
    await supabase.from('product_variants').delete().eq('product_id', productId);
    
    // Insert new variants
    await saveVariants(productId);
  };

  const handleSubmit = async (data: ProductFormData) => {
    // Validação customizada: estrutura obrigatória para kits
    if (data.product_format === 'with_composition' && componentsLoaded) {
      // Para edição, verificar componentes diretamente no banco (ProductStructureEditor salva direto)
      // Para criação, verificar pendingComponents
      let hasComponents = pendingComponents.length > 0;
      
      if (isEditing && product?.id) {
        const { count } = await supabase
          .from('product_components')
          .select('id', { count: 'exact', head: true })
          .eq('parent_product_id', product.id);
        hasComponents = (count ?? 0) > 0;
      }
      
      if (!hasComponents) {
        toast({ 
          title: 'Estrutura obrigatória', 
          description: 'Produtos com composição precisam ter pelo menos um componente na estrutura.',
          variant: 'destructive' 
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, ...data });
        
        // Update related products and variants
        // Note: Components are managed directly by ProductStructureEditor (saves to DB on each action)
        // so we don't call updateComponents here to avoid overwriting with empty pendingComponents
        await updateRelatedProducts(product.id);
        if (data.product_format === 'with_variants') {
          await updateVariants(product.id);
        }
        
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        // Create product first
        const result = await createProduct.mutateAsync({
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

        // Save pending data using the new product ID
        const productResult = result as { id: string } | undefined;
        if (productResult?.id) {
          await uploadPendingImages(productResult.id);
          await saveRelatedProducts(productResult.id);
          if (data.product_format === 'with_composition') {
            await saveComponents(productResult.id);
          }
          if (data.product_format === 'with_variants') {
            await saveVariants(productResult.id);
          }
        }

        toast({ title: 'Produto criado com sucesso!' });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ 
        title: 'Erro ao salvar produto', 
        description: 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
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
            {/* Helper function to get errors per tab */}
            {(() => {
              const errors = form.formState.errors;
              const productFormat = form.watch('product_format');
              // Para edição, usa hasSavedComponents (sincronizado com DB); para criação, usa pendingComponents
              const hasComponents = isEditing ? hasSavedComponents : pendingComponents.length > 0;
              const hasStructureError = productFormat === 'with_composition' && componentsLoaded && !hasComponents;
              
              const tabErrors = {
                basic: ['name', 'sku', 'slug', 'description', 'short_description', 'status', 'product_format', 'weight', 'width', 'height', 'depth', 'gtin'].filter(f => f in errors).length,
                images: 0,
                pricing: ['price', 'cost_price', 'compare_at_price', 'promotion_start_date', 'promotion_end_date'].filter(f => f in errors).length,
                inventory: ['stock_quantity', 'low_stock_threshold', 'manage_stock', 'allow_backorder'].filter(f => f in errors).length,
                structure: hasStructureError ? 1 : 0,
                related: 0,
                seo: ['seo_title', 'seo_description'].filter(f => f in errors).length,
                advanced: ['ncm', 'cest', 'origin_code', 'uom', 'brand', 'vendor', 'product_type', 'tax_code', 'requires_shipping', 'taxable'].filter(f => f in errors).length,
              };

              const ErrorBadge = ({ count }: { count: number }) => 
                count > 0 ? (
                  <Badge variant="destructive" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold">
                    {count}
                  </Badge>
                ) : null;

              return (
                <TabsList className="grid w-full grid-cols-8">
                  <TabsTrigger value="basic" className="flex items-center gap-1">
                    Básico
                    <ErrorBadge count={tabErrors.basic} />
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex items-center gap-1">
                    <ImageIcon className="h-4 w-4 mr-1" />
                    Imagens
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="flex items-center gap-1">
                    Preços
                    <ErrorBadge count={tabErrors.pricing} />
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="flex items-center gap-1">
                    Estoque
                    <ErrorBadge count={tabErrors.inventory} />
                  </TabsTrigger>
                  <TabsTrigger 
                    value="structure" 
                    disabled={form.watch('product_format') !== 'with_composition'}
                    title={form.watch('product_format') !== 'with_composition' ? 'Selecione "Com composição (Kit)" no formato para habilitar' : ''}
                    className="flex items-center gap-1"
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Estrutura
                    <ErrorBadge count={tabErrors.structure} />
                  </TabsTrigger>
                  <TabsTrigger value="related" className="flex items-center gap-1">
                    <Link2 className="h-4 w-4 mr-1" />
                    Relacionados
                  </TabsTrigger>
                  <TabsTrigger value="seo" className="flex items-center gap-1">
                    SEO
                    <ErrorBadge count={tabErrors.seo} />
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="flex items-center gap-1">
                    Avançado
                    <ErrorBadge count={tabErrors.advanced} />
                  </TabsTrigger>
                </TabsList>
              );
            })()}

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
                        <div className="flex items-center justify-between">
                          <FormLabel>Descrição Curta</FormLabel>
                          <AIDescriptionButton
                            type="short_description"
                            productName={form.watch('name')}
                            fullDescription={form.watch('description') ?? ''}
                            onGenerated={(text) => form.setValue('short_description', text, { shouldDirty: true })}
                          />
                        </div>
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
                        <div className="flex items-center justify-between">
                          <FormLabel>Descrição Completa</FormLabel>
                          <AIDescriptionButton
                            type="full_description"
                            productName={form.watch('name')}
                            fullDescription={field.value ?? ''}
                            onGenerated={(text) => form.setValue('description', text, { shouldDirty: true })}
                            productFormat={form.watch('product_format') as 'simple' | 'with_variants' | 'with_composition'}
                            productId={product?.id}
                          />
                        </div>
                        <FormControl>
                          <ProductRichTextEditor
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            placeholder="Descrição detalhada do produto..."
                            minHeight="250px"
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

                  {/* Variants Picker - shown when product_format is with_variants */}
                  {form.watch('product_format') === 'with_variants' && (
                    <ProductVariantPicker
                      variants={pendingVariants}
                      onChange={setPendingVariants}
                      productName={form.watch('name')}
                      productSku={form.watch('sku')}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informações Físicas *</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Obrigatório para cálculo de frete. Preencha peso e dimensões corretamente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso (kg) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="Ex: 0.5"
                              value={field.value !== undefined && field.value !== null ? field.value : ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
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
                          <FormLabel>Largura (cm) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 20"
                              value={field.value !== undefined && field.value !== null ? field.value : ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
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
                          <FormLabel>Altura (cm) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 10"
                              value={field.value !== undefined && field.value !== null ? field.value : ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
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
                          <FormLabel>Profundidade (cm) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 5"
                              value={field.value !== undefined && field.value !== null ? field.value : ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseFloat(e.target.value) : undefined
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
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
                    <ProductImageUploader
                      images={pendingImages}
                      onImagesChange={setPendingImages}
                    />
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
                    onComponentsChange={setHasSavedComponents}
                  />
                ) : (
                  <ProductComponentsPicker
                    components={pendingComponents}
                    onComponentsChange={setPendingComponents}
                    stockType={form.watch('stock_type')}
                    onStockTypeChange={(type) => form.setValue('stock_type', type)}
                  />
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
                        Selecione o formato "<strong>Com composição (Kit)</strong>" na aba Básico para habilitar
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
                <RelatedProductsPicker
                  selectedIds={pendingRelatedIds}
                  onSelectionChange={setPendingRelatedIds}
                />
              )}
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>SEO e Mecanismos de Busca</CardTitle>
                  <GenerateSeoButton
                    input={{
                      type: 'product',
                      name: form.getValues('name'),
                      description: form.getValues('description') || '',
                      price: Math.round((form.getValues('price') || 0) * 100),
                    }}
                    onGenerated={(result) => {
                      form.setValue('seo_title', result.seo_title);
                      form.setValue('seo_description', result.seo_description);
                    }}
                    disabled={!form.getValues('name')}
                  />
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
                  <div className="grid gap-4 md:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="ncm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NCM *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value ?? ''} 
                              placeholder="00000000"
                              inputMode="numeric"
                              maxLength={8}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/[^\d]/g, '');
                                field.onChange(cleaned);
                              }}
                            />
                          </FormControl>
                          <FormDescription>Obrigatório para emissão de NF-e (8 dígitos)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                          <FormDescription>Código da Subst. Tributária</FormDescription>
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

          <div className="sticky bottom-0 bg-background border-t py-4 -mx-4 px-4 md:-mx-6 md:px-6 flex items-center justify-end gap-4 z-10">
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Falta preencher campos obrigatórios</span>
              </div>
            )}
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
