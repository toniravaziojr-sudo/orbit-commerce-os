// =============================================
// CREATE LANDING PAGE DIALOG
// Wizard para criar nova landing page com IA
// V4.0: Added briefing step with enum-based fields
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Target,
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

// Briefing types (enums saved in English, UI displays PT-BR)
type ObjectiveType = 'lead' | 'whatsapp' | 'sale' | 'checkout' | 'scheduling' | 'quiz' | 'signup' | 'download';
type TrafficTemp = 'cold' | 'warm' | 'hot';
type TrafficSource = 'meta' | 'google' | 'organic' | 'email' | 'remarketing' | 'direct';
type AwarenessLevel = 'unaware' | 'pain_aware' | 'solution_aware' | 'product_aware' | 'ready';
type PreferredCTA = 'whatsapp' | 'buy' | 'signup' | 'schedule' | 'download';
type Restriction = 'no_countdown' | 'no_video' | 'no_comparisons';

interface Briefing {
  objective: ObjectiveType;
  trafficTemp: TrafficTemp;
  trafficSource: TrafficSource;
  awarenessLevel: AwarenessLevel;
  preferredCTA?: PreferredCTA;
  restrictions?: Restriction[];
}

type Step = 'info' | 'products' | 'reference' | 'briefing' | 'prompt' | 'generating';

const OBJECTIVE_OPTIONS: { value: ObjectiveType; label: string }[] = [
  { value: 'sale', label: 'Venda direta' },
  { value: 'lead', label: 'Captura de lead' },
  { value: 'whatsapp', label: 'Conversa no WhatsApp' },
  { value: 'checkout', label: 'Click-through para checkout' },
  { value: 'scheduling', label: 'Agendamento' },
  { value: 'signup', label: 'Cadastro' },
  { value: 'download', label: 'Download' },
  { value: 'quiz', label: 'Quiz / Questionário' },
];

const TRAFFIC_SOURCE_OPTIONS: { value: TrafficSource; label: string }[] = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'organic', label: 'Orgânico / SEO' },
  { value: 'email', label: 'E-mail Marketing' },
  { value: 'remarketing', label: 'Remarketing' },
  { value: 'direct', label: 'Acesso Direto' },
];

const AWARENESS_OPTIONS: { value: AwarenessLevel; label: string; description: string }[] = [
  { value: 'unaware', label: 'Inconsciente', description: 'Não sabe que tem um problema' },
  { value: 'pain_aware', label: 'Ciente da dor', description: 'Sabe do problema, não conhece a solução' },
  { value: 'solution_aware', label: 'Ciente da solução', description: 'Sabe que existem soluções, não conhece a sua' },
  { value: 'product_aware', label: 'Ciente do produto', description: 'Conhece seu produto, ainda não comprou' },
  { value: 'ready', label: 'Pronto para comprar', description: 'Quer comprar, precisa só de um empurrão' },
];

const CTA_OPTIONS: { value: PreferredCTA; label: string }[] = [
  { value: 'buy', label: 'Comprar Agora' },
  { value: 'whatsapp', label: 'Falar no WhatsApp' },
  { value: 'signup', label: 'Cadastrar' },
  { value: 'schedule', label: 'Agendar' },
  { value: 'download', label: 'Baixar' },
];

const RESTRICTION_OPTIONS: { value: Restriction; label: string }[] = [
  { value: 'no_countdown', label: 'Sem countdown / timer' },
  { value: 'no_video', label: 'Sem seção de vídeo' },
  { value: 'no_comparisons', label: 'Sem tabela comparativa' },
];

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

  // Briefing state
  const [briefing, setBriefing] = useState<Briefing>({
    objective: 'sale',
    trafficTemp: 'cold',
    trafficSource: 'meta',
    awarenessLevel: 'pain_aware',
    restrictions: [],
  });

  // Fetch products
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products-for-landing', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const productsQuery = supabase.from('products').select('id, name, price, compare_at_price') as any;
      const productsResult = await productsQuery
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(100);
      if (productsResult.error) throw productsResult.error;
      const productsData = (productsResult.data || []) as Array<{
        id: string; name: string; price: number; compare_at_price: number | null;
      }>;
      if (productsData.length === 0) return [];
      const productIds = productsData.map(p => p.id);
      const imagesQuery = supabase.from('product_images').select('product_id, url') as any;
      const imagesResult = await imagesQuery.in('product_id', productIds).eq('is_primary', true);
      const imageMap = new Map<string, string>();
      ((imagesResult.data || []) as Array<{ product_id: string; url: string }>).forEach(
        img => imageMap.set(img.product_id, img.url)
      );
      return productsData.map(p => ({
        id: p.id, name: p.name, price: p.price, compare_at_price: p.compare_at_price,
        product_images: imageMap.has(p.id) ? [{ url: imageMap.get(p.id)! }] : undefined,
      }));
    },
    enabled: !!tenant?.id && open,
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !user?.id) throw new Error('Missing data');

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
          briefing: briefing as any,
          show_header: false,
          show_footer: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      const { error: genError } = await supabase.functions.invoke('ai-landing-page-generate', {
        body: {
          landingPageId: landingPage.id,
          tenantId: tenant.id,
          userId: user.id,
          prompt,
          promptType: 'initial',
          referenceUrl: referenceUrl || null,
          productIds: selectedProducts,
          briefing,
        },
      });

      if (genError) {
        console.error('Generation error:', genError);
      }

      // Step 2: Trigger async image enhancement with recursive chunking (non-blocking)
      if (!genError && selectedProducts.length > 0) {
        const enhanceRecursive = async (startFromIndex = 0, stage = 1) => {
          try {
            const { data, error } = await supabase.functions.invoke('ai-landing-page-enhance-images', {
              body: {
                landingPageId: landingPage.id,
                tenantId: tenant.id,
                userId: user.id,
                startFromIndex,
                stage,
              },
            });
            if (error) {
              console.warn(`Image enhancement error (stage ${stage}):`, error);
              return;
            }
            console.log(`[LP-Enhance] Stage ${stage}: ${data?.enhanced || 0} sections enhanced, done: ${data?.done}`);
            // If there are more sections to process, call again with next index
            if (data && !data.done && data.nextIndex != null) {
              console.log(`[LP-Enhance] Scheduling stage ${data.nextStage} from index ${data.nextIndex}...`);
              await enhanceRecursive(data.nextIndex, data.nextStage);
            } else {
              console.log('[LP-Enhance] All sections enhanced!');
              // Set status to 'draft' now that images are ready
              await supabase
                .from('ai_landing_pages')
                .update({ status: 'draft' })
                .eq('id', landingPage.id);
              queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
            }
          } catch (e) {
            console.warn('Image enhancement recursive error:', e);
          }
        };
        enhanceRecursive();
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
    setName(""); setSlug(""); setReferenceUrl(""); setSelectedProducts([]);
    setPrompt(""); setProductSearch("");
    setBriefing({ objective: 'sale', trafficTemp: 'cold', trafficSource: 'meta', awarenessLevel: 'pain_aware', restrictions: [] });
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleRestriction = (restriction: Restriction) => {
    setBriefing(prev => ({
      ...prev,
      restrictions: prev.restrictions?.includes(restriction)
        ? prev.restrictions.filter(r => r !== restriction)
        : [...(prev.restrictions || []), restriction],
    }));
  };

  const canProceedInfo = name.trim().length > 0;
  const canProceedProducts = selectedProducts.length > 0;
  const canProceedPrompt = prompt.trim().length > 10;

  const ALL_STEPS: Step[] = ['info', 'products', 'reference', 'briefing', 'prompt'];

  const nextStep = () => {
    if (step === 'info' && canProceedInfo) setStep('products');
    else if (step === 'products' && canProceedProducts) setStep('reference');
    else if (step === 'reference') setStep('briefing');
    else if (step === 'briefing') setStep('prompt');
    else if (step === 'prompt' && canProceedPrompt) {
      setStep('generating');
      createMutation.mutate();
    }
  };

  const prevStep = () => {
    if (step === 'products') setStep('info');
    else if (step === 'reference') setStep('products');
    else if (step === 'briefing') setStep('reference');
    else if (step === 'prompt') setStep('briefing');
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const currentStepIndex = ALL_STEPS.indexOf(step);

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
            {step === 'briefing' && 'Configure o briefing estratégico da sua página'}
            {step === 'prompt' && 'Descreva como deve ser sua landing page'}
            {step === 'generating' && 'Aguarde enquanto a IA cria sua página'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator — 5 steps */}
        <div className="flex items-center gap-2 py-2">
          {ALL_STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : currentStepIndex > i
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {currentStepIndex > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < ALL_STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${currentStepIndex > i ? 'bg-primary' : 'bg-muted'}`} />
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
                    if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  placeholder="Ex: Lançamento Produto X"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/ai-lp/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                    placeholder="lancamento-produto-x"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Deixe em branco para gerar automaticamente</p>
              </div>
            </div>
          )}

          {/* Step: Products */}
          {step === 'products' && (
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produtos..." className="pl-10" />
              </div>
              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map(id => {
                    const product = products?.find(p => p.id === id);
                    return product ? (
                      <Badge key={id} variant="secondary" className="flex items-center gap-1">
                        {product.name.slice(0, 20)}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleProduct(id)} />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <ScrollArea className="h-[300px] border rounded-md">
                {loadingProducts ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredProducts?.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Nenhum produto encontrado</div>
                ) : (
                  <div className="p-2 space-y-2">
                    {filteredProducts?.map(product => (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${selectedProducts.includes(product.id) ? 'bg-primary/10' : ''}`}
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Checkbox checked={selectedProducts.includes(product.id)} onCheckedChange={() => toggleProduct(product.id)} />
                        {product.product_images?.[0]?.url ? (
                          <img src={product.product_images[0].url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(product.price)}
                            {product.compare_at_price && <span className="line-through ml-2">{formatPrice(product.compare_at_price)}</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <p className="text-sm text-muted-foreground">{selectedProducts.length} produto(s) selecionado(s)</p>
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
                <Input id="reference" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://exemplo.com/landing-page-inspiracao" />
                <p className="text-sm text-muted-foreground">Cole a URL de uma landing page que você gostaria de usar como referência de design.</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">💡 Dica:</p>
                <p className="text-sm text-muted-foreground">
                  Fornecer uma referência ajuda a IA a entender o estilo visual e a estrutura que você deseja.
                </p>
              </div>
            </div>
          )}

          {/* Step: Briefing (NEW — V4.0) */}
          {step === 'briefing' && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-5 py-4 pr-4">
                {/* Objective */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Objetivo da Página *
                  </Label>
                  <Select value={briefing.objective} onValueChange={(v) => setBriefing(prev => ({ ...prev, objective: v as ObjectiveType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OBJECTIVE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Traffic Temperature */}
                <div className="space-y-2">
                  <Label>Temperatura do Tráfego *</Label>
                  <RadioGroup value={briefing.trafficTemp} onValueChange={(v) => setBriefing(prev => ({ ...prev, trafficTemp: v as TrafficTemp }))} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cold" id="cold" />
                      <Label htmlFor="cold" className="font-normal cursor-pointer">🧊 Frio</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="warm" id="warm" />
                      <Label htmlFor="warm" className="font-normal cursor-pointer">🌤️ Morno</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="hot" id="hot" />
                      <Label htmlFor="hot" className="font-normal cursor-pointer">🔥 Quente</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Traffic Source */}
                <div className="space-y-2">
                  <Label>Fonte de Tráfego *</Label>
                  <Select value={briefing.trafficSource} onValueChange={(v) => setBriefing(prev => ({ ...prev, trafficSource: v as TrafficSource }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRAFFIC_SOURCE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Awareness Level */}
                <div className="space-y-2">
                  <Label>Nível de Consciência do Público *</Label>
                  <RadioGroup value={briefing.awarenessLevel} onValueChange={(v) => setBriefing(prev => ({ ...prev, awarenessLevel: v as AwarenessLevel }))} className="space-y-2">
                    {AWARENESS_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-start space-x-2">
                        <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
                        <div>
                          <Label htmlFor={opt.value} className="font-normal cursor-pointer">{opt.label}</Label>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Preferred CTA (optional) */}
                <div className="space-y-2">
                  <Label>CTA Preferido (opcional)</Label>
                  <Select value={briefing.preferredCTA || ''} onValueChange={(v) => setBriefing(prev => ({ ...prev, preferredCTA: (v || undefined) as PreferredCTA | undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Automático (baseado no objetivo)" /></SelectTrigger>
                    <SelectContent>
                      {CTA_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Restrictions */}
                <div className="space-y-2">
                  <Label>Restrições (opcional)</Label>
                  <div className="space-y-2">
                    {RESTRICTION_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={opt.value}
                          checked={briefing.restrictions?.includes(opt.value) || false}
                          onCheckedChange={() => toggleRestriction(opt.value)}
                        />
                        <Label htmlFor={opt.value} className="font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
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
                <p className="text-sm text-muted-foreground">Quanto mais detalhes você fornecer, melhor será o resultado.</p>
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
            <Button variant="ghost" onClick={prevStep} disabled={step === 'info'}>
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
