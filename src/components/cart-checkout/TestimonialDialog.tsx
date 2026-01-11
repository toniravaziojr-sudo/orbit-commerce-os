// =============================================
// TESTIMONIAL DIALOG - Create/Edit testimonial
// =============================================

import { useEffect, useState, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  useCheckoutTestimonials, 
  CheckoutTestimonial 
} from '@/hooks/useCheckoutTestimonials';
import { useProductsWithImages } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useSystemUpload } from '@/hooks/useSystemUpload';
import { Star, Loader2, Search, X, Upload, Image as ImageIcon } from 'lucide-react';

const testimonialSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  content: z.string().min(1, 'Depoimento é obrigatório').max(220, 'Máximo 220 caracteres'),
  rating: z.number().min(1).max(5),
  image_url: z.string().nullable().optional(),
});

type TestimonialFormValues = z.infer<typeof testimonialSchema>;

interface TestimonialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial: CheckoutTestimonial | null;
}

function StarRating({ 
  value, 
  onChange 
}: { 
  value: number; 
  onChange: (value: number) => void 
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground hover:text-yellow-400'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function TestimonialDialog({
  open,
  onOpenChange,
  testimonial,
}: TestimonialDialogProps) {
  const { currentTenant } = useAuth();
  const { createTestimonial, updateTestimonial } = useCheckoutTestimonials();
  const { products, isLoading: productsLoading } = useProductsWithImages();
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload: systemUpload, isUploading } = useSystemUpload({
    source: 'testimonial_image',
    subPath: 'testimonials',
  });

  const form = useForm<TestimonialFormValues>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      name: '',
      content: '',
      rating: 5,
      image_url: null,
    },
  });

  const isEditing = !!testimonial;

  useEffect(() => {
    if (open) {
      if (testimonial) {
        form.reset({
          name: testimonial.name,
          content: testimonial.content,
          rating: testimonial.rating,
          image_url: testimonial.image_url,
        });
        setSelectedProductIds(testimonial.product_ids || []);
      } else {
        form.reset({
          name: '',
          content: '',
          rating: 5,
          image_url: null,
        });
        setSelectedProductIds([]);
      }
      setProductSearch('');
      setShowProductSelector(false);
    }
  }, [open, testimonial, form]);

  const handleImageUpload = async (file: File) => {
    if (!currentTenant?.id) return;
    
    const result = await systemUpload(file);
    if (result?.publicUrl) {
      form.setValue('image_url', result.publicUrl);
    }
  };

  const onSubmit = async (values: TestimonialFormValues) => {
    const data = {
      name: values.name,
      content: values.content,
      rating: values.rating,
      image_url: values.image_url || null,
      product_ids: selectedProductIds,
    };

    if (isEditing && testimonial) {
      await updateTestimonial.mutateAsync({ id: testimonial.id, ...data });
    } else {
      await createTestimonial.mutateAsync(data);
    }

    onOpenChange(false);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const removeProduct = (productId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== productId));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

  const contentLength = form.watch('content')?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Depoimento' : 'Novo Depoimento'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do depoimento'
              : 'Adicione um novo depoimento de cliente'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Image Upload */}
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foto do Cliente (opcional)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        {field.value ? (
                          <div className="relative">
                            <img
                              src={field.value}
                              alt="Avatar"
                              className="w-20 h-20 rounded-full object-cover border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => field.onChange(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="w-20 h-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {isUploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                              </>
                            )}
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Imagem em JPG com 150x150 px
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Rating */}
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Estrelas</FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Pessoa</FormLabel>
                    <FormControl>
                      <Input placeholder="Maria S." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Content */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depoimento</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Escreva o depoimento do cliente..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-end">
                      <span className={`text-xs ${contentLength > 220 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {contentLength}/220
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Products Section */}
              <div className="space-y-3">
                <div>
                  <FormLabel>Produtos</FormLabel>
                  <FormDescription>
                    Selecione produtos específicos para que a prova social seja mostrada.
                    Caso queira que seja mostrada para <strong>todos os produtos</strong>, deixe este campo vazio.
                  </FormDescription>
                </div>

                {/* Selected Products */}
                {selectedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedProducts.map(product => (
                      <Badge key={product.id} variant="secondary" className="gap-1">
                        {product.name}
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Product Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductSelector(true);
                    }}
                    onFocus={() => setShowProductSelector(true)}
                    className="pl-9"
                  />
                </div>

                {/* Product List */}
                {showProductSelector && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {productsLoading ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Carregando produtos...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        Nenhum produto encontrado
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredProducts.slice(0, 10).map(product => (
                          <label
                            key={product.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={() => toggleProduct(product.id)}
                            />
                            {product.primary_image_url ? (
                              <img
                                src={product.primary_image_url}
                                alt={product.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs">
                                IMG
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedProductIds.length === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Nenhum produto adicionado. Este depoimento será exibido para todos os produtos.
                    </p>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={form.formState.isSubmitting || isUploading}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              'Salvar'
            ) : (
              'Adicionar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
