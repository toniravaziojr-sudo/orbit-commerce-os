// =============================================
// CREATE LANDING PAGE DIALOG
// Wizard para criar nova landing page com IA
// =============================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sparkles,
  Link2,
  Package,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Search,
  X,
} from "lucide-react";

interface CreateLandingPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  product_images?: { url: string }[];
}

type Step = 'info' | 'products' | 'reference' | 'prompt' | 'generating';

export function CreateLandingPageDialog({ open, onOpenChange }: CreateLandingPageDialogProps) {
  const navigate = useNavigate();
  const { currentTenant: tenant, user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [productSearch, setProductSearch] = useState("");

  // Fetch products
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products-for-landing', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      // Fetch products - using explicit any to avoid deep type instantiation
      const productsQuery = supabase.from('products').select('id, name, price, compare_at_price') as any;
      const productsResult = await productsQuery
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(100);
      
      if (productsResult.error) throw productsResult.error;
      const productsData = (productsResult.data || []) as Array<{
        id: string;
        name: string;
        price: number;
        compare_at_price: number | null;
      }>;
      
      if (productsData.length === 0) return [];
      
      // Fetch images separately
      const productIds = productsData.map(p => p.id);
      const imagesQuery = supabase.from('product_images').select('product_id, url') as any;
      const imagesResult = await imagesQuery.in('product_id', productIds).eq('is_primary', true);
      
      const imageMap = new Map<string, string>();
      ((imagesResult.data || []) as Array<{ product_id: string; url: string }>).forEach(
        img => imageMap.set(img.product_id, img.url)
      );
      
      return productsData.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        compare_at_price: p.compare_at_price,
        product_images: imageMap.has(p.id) ? [{ url: imageMap.get(p.id)! }] : undefined,
      }));
    },
    enabled: !!tenant?.id && open,
  });

  // Filter products
  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !user?.id) throw new Error('Missing data');

      // Create landing page record first
      const { data: landingPage, error: createError } = await supabase
        .from('ai_landing_pages')
        .insert({
          tenant_id: tenant.id,
          created_by: user.id,
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          reference_url: referenceUrl || null,
          product_ids: selectedProducts,
          initial_prompt: prompt,
          status: 'generating',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Trigger generation via edge function
      const { error: genError } = await supabase.functions.invoke('ai-landing-page-generate', {
        body: {
          landingPageId: landingPage.id,
          tenantId: tenant.id,
          userId: user.id,
          prompt,
          promptType: 'initial',
          referenceUrl: referenceUrl || null,
          productIds: selectedProducts,
        },
      });

      if (genError) {
        console.error('Generation error:', genError);
        // Don't throw - page was created, generation will retry
      }

      return landingPage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
      toast.success('Landing page criada! A IA está gerando sua página...');
      onOpenChange(false);
      navigate(`/landing-pages/${data.id}`);
      resetForm();
    },
    onError: (error) => {
      console.error('Create error:', error);
      toast.error('Erro ao criar landing page');
      setStep('prompt');
    },
  });

  const resetForm = () => {
    setStep('info');
    setName("");
    setSlug("");
    setReferenceUrl("");
    setSelectedProducts([]);
    setPrompt("");
    setProductSearch("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const canProceedInfo = name.trim().length > 0;
  const canProceedProducts = selectedProducts.length > 0;
  const canProceedPrompt = prompt.trim().length > 10;

  const nextStep = () => {
    if (step === 'info' && canProceedInfo) setStep('products');
    else if (step === 'products' && canProceedProducts) setStep('reference');
    else if (step === 'reference') setStep('prompt');
    else if (step === 'prompt' && canProceedPrompt) {
      setStep('generating');
      createMutation.mutate();
    }
  };

  const prevStep = () => {
    if (step === 'products') setStep('info');
    else if (step === 'reference') setStep('products');
    else if (step === 'prompt') setStep('reference');
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nova Landing Page com IA
          </DialogTitle>
          <DialogDescription>
            {step === 'info' && 'Defina o nome e a URL da sua landing page'}
            {step === 'products' && 'Selecione os produtos que serão exibidos'}
            {step === 'reference' && 'Opcionalmente, forneça uma referência de design'}
            {step === 'prompt' && 'Descreva como deve ser sua landing page'}
            {step === 'generating' && 'Aguarde enquanto a IA cria sua página'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 py-2">
          {(['info', 'products', 'reference', 'prompt'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : (['info', 'products', 'reference', 'prompt'].indexOf(step) > i)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {['info', 'products', 'reference', 'prompt'].indexOf(step) > i ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div className={`w-8 h-0.5 ${
                  ['info', 'products', 'reference', 'prompt'].indexOf(step) > i
                    ? 'bg-primary'
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Step: Info */}
          {step === 'info' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Landing Page *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  placeholder="Ex: Lançamento Produto X"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/lp/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                    placeholder="lancamento-produto-x"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para gerar automaticamente
                </p>
              </div>
            </div>
          )}

          {/* Step: Products */}
          {step === 'products' && (
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="pl-10"
                />
              </div>

              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map(id => {
                    const product = products?.find(p => p.id === id);
                    return product ? (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1">
                        {product.name.slice(0, 20)}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => toggleProduct(id)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              <ScrollArea className="h-[300px] border rounded-md">
                {loadingProducts ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredProducts?.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {filteredProducts?.map(product => (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                          selectedProducts.includes(product.id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        {product.product_images?.[0]?.url ? (
                          <img
                            src={product.product_images[0].url}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(product.price)}
                            {product.compare_at_price && (
                              <span className="line-through ml-2">
                                {formatPrice(product.compare_at_price)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} produto(s) selecionado(s)
              </p>
            </div>
          )}

          {/* Step: Reference */}
          {step === 'reference' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reference" className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  URL de Referência (opcional)
                </Label>
                <Input
                  id="reference"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://exemplo.com/landing-page-inspiracao"
                />
                <p className="text-sm text-muted-foreground">
                  Cole a URL de uma landing page que você gostaria de usar como referência de design.
                  A IA irá analisar a estrutura e criar algo similar adaptado aos seus produtos.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">💡 Dica:</p>
                <p className="text-sm text-muted-foreground">
                  Fornecer uma referência ajuda a IA a entender o estilo visual e a estrutura
                  que você deseja, resultando em uma landing page mais alinhada às suas expectativas.
                </p>
              </div>
            </div>
          )}

          {/* Step: Prompt */}
          {step === 'prompt' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Descreva sua Landing Page *</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descreva como deve ser sua landing page. Ex: Quero uma landing page moderna e clean para vender meu curso de marketing digital. Deve ter seções de benefícios, depoimentos, garantia e um formulário de captura no topo. Use cores vibrantes e CTAs chamativos."
                  className="min-h-[150px]"
                />
                <p className="text-sm text-muted-foreground">
                  Quanto mais detalhes você fornecer, melhor será o resultado.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">💡 Sugestões de elementos:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Hero com headline chamativa</li>
                  <li>• Seção de benefícios do produto</li>
                  <li>• Depoimentos de clientes</li>
                  <li>• Garantia e políticas</li>
                  <li>• FAQ para eliminar objeções</li>
                  <li>• CTA forte e visível</li>
                  <li>• Contador de urgência</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
                <Loader2 className="h-8 w-8 absolute -bottom-2 -right-2 animate-spin text-primary" />
              </div>
              <h3 className="text-lg font-medium">Criando sua landing page...</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                A IA está analisando suas preferências e gerando uma landing page otimizada para conversão.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'generating' && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={step === 'info'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={nextStep}
              disabled={
                (step === 'info' && !canProceedInfo) ||
                (step === 'products' && !canProceedProducts) ||
                (step === 'prompt' && !canProceedPrompt)
              }
            >
              {step === 'prompt' ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Landing Page
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
