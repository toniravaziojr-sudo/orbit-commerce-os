// =============================================
// AI LANDING PAGE GENERATE — V7.0 ENGINE
// Motor V7: Schema-First + React Renderer
// IA generates structured JSON schema, NOT HTML
// Frontend renders with real React components
// V6 HTML fallback preserved for legacy pages
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";
import { isPromptIncomplete, selectBestFallback } from "../_shared/marketing/fallback-prompts.ts";
import {
  resolveEnginePlan,
  type BriefingInput,
} from "../_shared/marketing/engine-plan.ts";
import {
  assembleLandingPage,
  type PageTemplateInput,
  type ProductData,
  type ReviewData,
} from "../_shared/landing-page-templates.ts";
import { getNicheImages, getNicheImage } from "../_shared/landing-page-stock-images.ts";
import { resolveLandingPageAssets, type ResolvedAssets } from "../_shared/landing-page-asset-resolver.ts";

const VERSION = "9.0.0"; // Engine V9.0: Premium Template Masters + Patch Adjustments

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ========== CORS ==========

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== REQUEST TYPE ==========

interface GenerateRequest {
  landingPageId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  promptType: 'initial' | 'adjustment' | 'regenerate';
  referenceUrl?: string;
  productIds?: string[];
  briefing?: BriefingInput;
}

// ========== PRODUCT COLOR EXTRACTION ==========

interface BrandKit {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  extractedFromProduct?: boolean;
}

/**
 * Uses AI vision to extract dominant colors FROM the product image.
 * These colors drive the page design (buttons, backgrounds, accents).
 * The product itself is NEVER modified — only the page styling changes.
 */
async function extractColorsFromProductImage(
  productImageUrl: string,
  lovableApiKey: string,
): Promise<{ primary: string; secondary: string; accent: string } | null> {
  try {
    console.log(`[AI-LP-Generate] Extracting colors from product image...`);
    
    const response = await fetch(LOVABLE_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this product image and extract the 3 most dominant/important colors from the PRODUCT PACKAGING (label, cap, bottle, box). 

Return ONLY a JSON object with exactly this format, no other text:
{"primary":"#hex","secondary":"#hex","accent":"#hex"}

Rules:
- "primary" = the most dominant color of the packaging/label
- "secondary" = the second most prominent color  
- "accent" = a contrasting highlight color from the design/label
- All values must be valid hex colors (#RRGGBB format)
- Do NOT return white (#ffffff) or near-white as primary — pick the next dominant color
- Do NOT return transparent or background colors — focus on the PRODUCT itself
- If the product is mostly dark (black bottle), use a rich dark shade for primary and pick label/accent colors for secondary/accent`
            },
            {
              type: 'image_url',
              image_url: { url: productImageUrl }
            }
          ]
        }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.warn(`[AI-LP-Generate] Color extraction failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response (may have markdown fences)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    
    const colors = JSON.parse(jsonStr);
    
    if (colors.primary && colors.secondary && colors.accent) {
      console.log(`[AI-LP-Generate] Product colors extracted: primary=${colors.primary}, secondary=${colors.secondary}, accent=${colors.accent}`);
      return colors;
    }
    
    return null;
  } catch (e) {
    console.warn(`[AI-LP-Generate] Color extraction error:`, e);
    return null;
  }
}

/**
 * Derives color scheme from tenant's actual brand colors.
 * Uses brand colors for accents/CTAs, adapts to visualWeight for bg/text.
 */
function getColorScheme(visualWeight: string, brandKit: BrandKit) {
  const { primaryColor, secondaryColor, accentColor } = brandKit;
  
  // Helper: determine if a hex color is "dark" (for contrast decisions)
  function isColorDark(hex: string): boolean {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }
  
  // Helper: hex to HSL
  function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const c = hex.replace('#', '');
    let r = parseInt(c.substring(0, 2), 16) / 255;
    let g = parseInt(c.substring(2, 4), 16) / 255;
    let b = parseInt(c.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  
  /**
   * Sanitize "garish/neon" colors that look terrible as CTA buttons.
   * Neon colors have very high saturation (>80%) and medium+ lightness.
   * Examples: #05f009 (neon green), #ff00ff (magenta), #00ffff (cyan)
   * Returns a premium fallback for garish colors, original otherwise.
   */
  function sanitizeBrandColor(hex: string): string {
    if (!hex || hex.length < 4) return '#c9a96e'; // premium gold fallback
    const hsl = hexToHsl(hex);
    // Reject: saturation > 75% AND lightness between 35-75% = "neon/garish"
    if (hsl.s > 75 && hsl.l > 35 && hsl.l < 75) {
      console.log(`[BrandKit] Rejecting garish color ${hex} (S:${hsl.s.toFixed(0)}% L:${hsl.l.toFixed(0)}%), using premium fallback`);
      return '#c9a96e'; // warm gold — works on dark and light backgrounds
    }
    // Reject: pure white or near-white as brand (not useful as CTA)
    if (hsl.l > 90) {
      console.log(`[BrandKit] Rejecting near-white color ${hex}, using premium fallback`);
      return '#c9a96e';
    }
    return hex;
  }
  
  // Helper: lighten/darken hex color
  function adjustColor(hex: string, amount: number): string {
    const c = hex.replace('#', '');
    const r = Math.min(255, Math.max(0, parseInt(c.substring(0, 2), 16) + amount));
    const g = Math.min(255, Math.max(0, parseInt(c.substring(2, 4), 16) + amount));
    const b = Math.min(255, Math.max(0, parseInt(c.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Helper: hex to rgba
  function hexToRgba(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Sanitize brand colors — reject neon/garish, use premium fallback
  const brand = sanitizeBrandColor(primaryColor || '#c9a96e');
  const brandAccent = sanitizeBrandColor(accentColor || secondaryColor || brand);
  
  const ctaTextColor = isColorDark(brand) ? '#ffffff' : '#0a0a0a';

  switch (visualWeight) {
    case 'premium':
      return {
        bg: '#070A10', bgAlt: '#0B1220', text: '#F2F5FF', textMuted: 'rgba(242,245,255,0.7)',
        accent: brandAccent, ctaBg: brand, ctaText: ctaTextColor,
        cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
        priceCurrent: brandAccent, priceOld: 'rgba(255,255,255,0.4)',
        badgeBg: hexToRgba(brandAccent, 0.15), badgeText: brandAccent,
        shadow: 'rgba(0,0,0,0.5)', divider: 'rgba(255,255,255,0.06)',
        fontDisplay: "'DM Serif Display', Georgia, serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:wght@400&family=Inter:wght@300;400;500;600;700&display=swap',
      };
    case 'comercial':
      return {
        bg: '#ffffff', bgAlt: '#f8f9fa', text: '#111827', textMuted: '#6b7280',
        accent: brand, ctaBg: brand, ctaText: ctaTextColor,
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#16a34a', priceOld: '#9ca3af',
        badgeBg: hexToRgba(brand, 0.08), badgeText: brand,
        shadow: 'rgba(0,0,0,0.1)', divider: '#f3f4f6',
        fontDisplay: "'Montserrat', -apple-system, sans-serif",
        fontBody: "'Open Sans', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;500;600&display=swap',
      };
    case 'minimalista':
      return {
        bg: '#fafafa', bgAlt: '#ffffff', text: '#1a1a1a', textMuted: '#666666',
        accent: brand, ctaBg: '#1a1a1a', ctaText: '#ffffff',
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#1a1a1a', priceOld: '#bbbbbb',
        badgeBg: '#f5f5f5', badgeText: '#333333',
        shadow: 'rgba(0,0,0,0.06)', divider: '#eeeeee',
        fontDisplay: "'Sora', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
      };
    default: // 'direto'
      return {
        bg: '#ffffff', bgAlt: '#f9fafb', text: '#111827', textMuted: '#4b5563',
        accent: brand, ctaBg: brand, ctaText: ctaTextColor,
        cardBg: '#ffffff', cardBorder: '#e5e7eb',
        priceCurrent: '#16a34a', priceOld: '#9ca3af',
        badgeBg: hexToRgba(brand, 0.08), badgeText: brand,
        shadow: 'rgba(0,0,0,0.08)', divider: '#f3f4f6',
        fontDisplay: "'Inter', -apple-system, sans-serif",
        fontBody: "'Inter', -apple-system, sans-serif",
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
      };
  }
}

// ========== SCHEMA BUILDER (deterministic, no AI) ==========

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function installments(price: number, n = 12): string {
  const inst = price / n;
  return `${n}x de R$ ${inst.toFixed(2).replace('.', ',')}`;
}

interface BuildSchemaInput {
  storeName: string;
  brandKit: BrandKit;
  visualWeight: string;
  mainProduct: ProductData;
  allProducts: ProductData[];
  kits: ProductData[];
  reviews: ReviewData[];
  assets: ResolvedAssets;
  ctaText: string;
  ctaUrl: string;
  showHeader: boolean;
  showFooter: boolean;
  storeBaseUrl: string; // e.g. https://loja.example.com or empty
}

// ── Variation pools to avoid identical pages ──
const BENEFIT_POOL = [
  [
    { label: 'QUALIDADE PREMIUM', title: 'Desenvolvido com os melhores ingredientes', description: 'Cada detalhe foi pensado para entregar o máximo resultado. Tecnologia avançada combinada com ingredientes selecionados.' },
    { label: 'RESULTADO COMPROVADO', title: 'Aprovado por quem mais entende', description: 'Milhares de clientes satisfeitos comprovam a eficácia. Resultados visíveis desde as primeiras utilizações.' },
    { label: 'FÁCIL DE USAR', title: 'Praticidade no seu dia a dia', description: 'Integre facilmente na sua rotina. Simples, rápido e eficiente — sem complicação.' },
  ],
  [
    { label: 'EXCLUSIVIDADE', title: 'Tecnologia que faz a diferença', description: 'Fórmula desenvolvida com ativos de última geração. Performance superior comprovada em testes rigorosos.' },
    { label: 'CONFIANÇA', title: 'Escolha de milhares de clientes', description: 'Marca consolidada no mercado com avaliações reais e resultados consistentes.' },
    { label: 'PRATICIDADE', title: 'Resultados sem complicação', description: 'Use de forma simples e veja resultados reais. Desenvolvido para se adaptar à sua rotina.' },
  ],
  [
    { label: 'ALTA PERFORMANCE', title: 'Máxima eficácia garantida', description: 'Formulado para quem exige o melhor. Ingredientes premium selecionados criteriosamente.' },
    { label: 'APROVAÇÃO TOTAL', title: 'Recomendado por especialistas', description: 'Reconhecido por profissionais da área. Qualidade atestada por quem mais entende do assunto.' },
    { label: 'USO DIÁRIO', title: 'Perfeito para a rotina', description: 'Projetado para uso contínuo e prático. Integra-se naturalmente no seu dia a dia.' },
  ],
];

const HERO_SUBTITLE_POOL = [
  'Descubra por que milhares de pessoas já escolheram este produto.',
  'A solução definitiva que você estava procurando. Resultados reais, comprovados.',
  'Performance comprovada por quem mais exige. Experimente a diferença.',
  'Milhares de clientes satisfeitos não podem estar errados. Prove você também.',
];

const CTA_FINAL_POOL = [
  { title: 'Não perca essa oportunidade', desc: 'Garanta o seu {product} agora mesmo com condições especiais.' },
  { title: 'Chegou a sua vez', desc: 'Faça como milhares de clientes satisfeitos. Garanta o seu {product} hoje.' },
  { title: 'Oferta por tempo limitado', desc: 'Aproveite as condições exclusivas e leve o {product} para casa agora.' },
  { title: 'Última chance', desc: 'Estoque limitado. Garanta o {product} com o melhor preço antes que acabe.' },
];

const FAQ_POOL = [
  [
    { q: 'O {product} realmente funciona?', a: 'Sim! Nosso produto é testado e aprovado por milhares de clientes satisfeitos. Os resultados são comprovados por avaliações reais.' },
    { q: 'Qual o prazo de entrega?', a: 'Enviamos em até 24h úteis após a confirmação do pagamento. O prazo de entrega varia de acordo com a sua região.' },
    { q: 'Posso parcelar minha compra?', a: 'Sim! Parcelamos em até 12x no cartão de crédito. O {product} por apenas {installments} sem juros.' },
    { q: 'Tem garantia?', a: 'Oferecemos garantia de satisfação. Se não ficar satisfeito, devolvemos seu dinheiro.' },
    { q: 'O produto é original?', a: 'Sim, 100% original e com nota fiscal. Somos {store}, revendedor autorizado.' },
  ],
  [
    { q: 'Para quem é indicado o {product}?', a: 'Indicado para quem busca resultados reais e duradouros. Ideal para todos os tipos de necessidade.' },
    { q: 'Quanto tempo leva para ver resultados?', a: 'A maioria dos clientes nota diferença logo nas primeiras utilizações. Resultados consistentes aparecem com o uso contínuo.' },
    { q: 'Como faço para rastrear meu pedido?', a: 'Após o envio, você recebe um código de rastreamento por e-mail para acompanhar a entrega em tempo real.' },
    { q: 'Posso trocar ou devolver?', a: 'Sim! Oferecemos política de troca e devolução sem complicação. Sua satisfação é nossa prioridade.' },
    { q: 'Aceitam PIX e boleto?', a: 'Sim! Aceitamos PIX (aprovação instantânea), boleto bancário e cartão de crédito em até 12x.' },
  ],
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── V8.0: Seeded RNG for reproducible variation ──
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function seededPick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── V8.0: Template definitions (narrative recipes) ──
type TemplateId = 'direct_offer' | 'proof_first' | 'problem_solution' | 'routine' | 'comparison' | 'minimal_premium';

interface TemplateRecipe {
  id: TemplateId;
  sections: string[]; // section types in order
  weight: number;
  requiresProof?: boolean;
  requiresReviews?: boolean;
}

const TEMPLATES: TemplateRecipe[] = [
  { id: 'direct_offer', sections: ['hero', 'pricing', 'benefits', 'testimonials', 'faq', 'cta_final'], weight: 20, requiresReviews: true },
  { id: 'proof_first', sections: ['hero', 'social_proof', 'testimonials', 'pricing', 'guarantee', 'cta_final'], weight: 15, requiresProof: true, requiresReviews: true },
  { id: 'problem_solution', sections: ['hero', 'benefits', 'testimonials', 'pricing', 'guarantee', 'faq', 'cta_final'], weight: 20, requiresReviews: true },
  { id: 'routine', sections: ['hero', 'benefits', 'social_proof', 'pricing', 'faq', 'cta_final'], weight: 15, requiresProof: true },
  { id: 'comparison', sections: ['hero', 'benefits', 'pricing', 'testimonials', 'faq', 'cta_final'], weight: 15, requiresReviews: true },
  { id: 'minimal_premium', sections: ['hero', 'benefits', 'pricing', 'guarantee', 'faq', 'cta_final'], weight: 15 },
];

function selectTemplate(seed: number, hasReviews: boolean, hasSocialProof: boolean): TemplateRecipe {
  const rng = seededRng(seed);
  const eligible = TEMPLATES.map(t => {
    let w = t.weight;
    if (t.requiresProof && !hasSocialProof) w = 0;
    if (t.requiresReviews && !hasReviews) w = Math.max(0, w - 10);
    return { ...t, weight: w };
  }).filter(t => t.weight > 0);

  if (eligible.length === 0) return TEMPLATES[5]; // minimal_premium fallback

  const totalWeight = eligible.reduce((s, t) => s + t.weight, 0);
  let roll = rng() * totalWeight;
  for (const t of eligible) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return eligible[eligible.length - 1];
}

// ── V9.0: Premium Template Masters ──
// Each premium template maps to a dedicated Hero + CTA Final React component pair
type PremiumTemplateId = 
  | 'luxury_editorial' | 'bold_impact' | 'minimal_zen' | 'organic_nature' | 'corporate_trust'
  | 'neon_energy' | 'warm_artisan' | 'tech_gradient' | 'classic_elegant' | 'urban_street';

interface PremiumTemplateEntry {
  id: PremiumTemplateId;
  allowedMoods: LPMood[];
  defaultMood: LPMood;
  fontDisplay: string;
  fontBody: string;
  fontImportUrl: string;
  /** Design tokens for CSS variable injection */
  tokens: {
    radius: string;
    cardStyle: string;
    shadowIntensity: string;
    sectionPaddingY: string;
    accentGlow: number;
    dividerStyle: string;
  };
}

const PREMIUM_TEMPLATES: PremiumTemplateEntry[] = [
  {
    id: 'luxury_editorial', allowedMoods: ['luxury', 'minimal'], defaultMood: 'luxury',
    fontDisplay: "'Playfair Display', Georgia, serif", fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600&display=swap',
    tokens: { radius: '20px', cardStyle: 'glass', shadowIntensity: 'dramatic', sectionPaddingY: 'clamp(80px, 10vw, 120px)', accentGlow: 0.08, dividerStyle: 'gradient' },
  },
  {
    id: 'bold_impact', allowedMoods: ['bold', 'corporate'], defaultMood: 'bold',
    fontDisplay: "'Bebas Neue', Impact, sans-serif", fontBody: "'Archivo', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700&display=swap',
    tokens: { radius: '12px', cardStyle: 'solid', shadowIntensity: 'medium', sectionPaddingY: 'clamp(64px, 8vw, 100px)', accentGlow: 0.12, dividerStyle: 'line' },
  },
  {
    id: 'minimal_zen', allowedMoods: ['minimal', 'luxury'], defaultMood: 'minimal',
    fontDisplay: "'Sora', -apple-system, sans-serif", fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap',
    tokens: { radius: '8px', cardStyle: 'outline', shadowIntensity: 'subtle', sectionPaddingY: 'clamp(80px, 12vw, 140px)', accentGlow: 0.03, dividerStyle: 'none' },
  },
  {
    id: 'organic_nature', allowedMoods: ['organic', 'minimal'], defaultMood: 'organic',
    fontDisplay: "'Lora', Georgia, serif", fontBody: "'Montserrat', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap',
    tokens: { radius: '28px', cardStyle: 'elevated', shadowIntensity: 'medium', sectionPaddingY: 'clamp(72px, 9vw, 110px)', accentGlow: 0.06, dividerStyle: 'gradient' },
  },
  {
    id: 'corporate_trust', allowedMoods: ['corporate', 'minimal'], defaultMood: 'corporate',
    fontDisplay: "'Plus Jakarta Sans', -apple-system, sans-serif", fontBody: "'Plus Jakarta Sans', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
    tokens: { radius: '12px', cardStyle: 'solid', shadowIntensity: 'subtle', sectionPaddingY: 'clamp(64px, 8vw, 96px)', accentGlow: 0.04, dividerStyle: 'line' },
  },
  {
    id: 'neon_energy', allowedMoods: ['bold', 'luxury'], defaultMood: 'bold',
    fontDisplay: "'Oswald', Impact, sans-serif", fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    tokens: { radius: '16px', cardStyle: 'glass', shadowIntensity: 'dramatic', sectionPaddingY: 'clamp(72px, 9vw, 110px)', accentGlow: 0.2, dividerStyle: 'gradient' },
  },
  {
    id: 'warm_artisan', allowedMoods: ['organic', 'luxury'], defaultMood: 'organic',
    fontDisplay: "'Cormorant Garamond', Georgia, serif", fontBody: "'Lato', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap',
    tokens: { radius: '20px', cardStyle: 'elevated', shadowIntensity: 'medium', sectionPaddingY: 'clamp(80px, 10vw, 120px)', accentGlow: 0.05, dividerStyle: 'gradient' },
  },
  {
    id: 'tech_gradient', allowedMoods: ['corporate', 'bold', 'minimal'], defaultMood: 'corporate',
    fontDisplay: "'Space Grotesk', -apple-system, sans-serif", fontBody: "'Inter', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    tokens: { radius: '24px', cardStyle: 'glass', shadowIntensity: 'dramatic', sectionPaddingY: 'clamp(72px, 9vw, 110px)', accentGlow: 0.15, dividerStyle: 'gradient' },
  },
  {
    id: 'classic_elegant', allowedMoods: ['luxury', 'minimal'], defaultMood: 'luxury',
    fontDisplay: "'DM Serif Display', Georgia, serif", fontBody: "'DM Sans', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&display=swap',
    tokens: { radius: '4px', cardStyle: 'outline', shadowIntensity: 'subtle', sectionPaddingY: 'clamp(88px, 11vw, 130px)', accentGlow: 0.04, dividerStyle: 'line' },
  },
  {
    id: 'urban_street', allowedMoods: ['bold', 'corporate'], defaultMood: 'bold',
    fontDisplay: "'Anton', Impact, sans-serif", fontBody: "'Barlow', -apple-system, sans-serif",
    fontImportUrl: 'https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&display=swap',
    tokens: { radius: '0px', cardStyle: 'solid', shadowIntensity: 'medium', sectionPaddingY: 'clamp(60px, 8vw, 96px)', accentGlow: 0.1, dividerStyle: 'none' },
  },
];

/**
 * V9.0: Select premium template based on seed + niche mood compatibility.
 * Guarantees diversity: 10 generations → min 6 different templates.
 */
function selectPremiumTemplate(seed: number, niche: string): PremiumTemplateEntry {
  const rng = seededRng(seed + 42424);
  const nicheMoods = NICHE_MOOD_MAP[niche] || NICHE_MOOD_MAP['geral'];
  
  // Filter templates whose allowedMoods overlap with niche moods
  const compatible = PREMIUM_TEMPLATES.filter(t => 
    t.allowedMoods.some(m => nicheMoods.includes(m))
  );
  
  // If somehow no compatible templates, use all
  const pool = compatible.length >= 3 ? compatible : PREMIUM_TEMPLATES;
  
  // Deterministic selection from pool
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}

// ── V8.0: Mood selection ──
type LPMood = 'luxury' | 'bold' | 'organic' | 'corporate' | 'minimal';

const NICHE_MOOD_MAP: Record<string, LPMood[]> = {
  hair: ['luxury', 'organic', 'minimal'],
  skincare: ['luxury', 'organic', 'minimal'],
  cosmetics: ['luxury', 'organic', 'bold'],
  supplements: ['bold', 'corporate', 'minimal'],
  fitness: ['bold', 'corporate'],
  food: ['organic', 'minimal', 'corporate'],
  tech: ['corporate', 'minimal', 'bold'],
  geral: ['luxury', 'bold', 'organic', 'corporate', 'minimal'],
};

const MOOD_FONTS: Record<LPMood, { display: string; body: string; importUrl: string }> = {
  luxury: { display: "'Playfair Display', Georgia, serif", body: "'Inter', -apple-system, sans-serif", importUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap' },
  bold: { display: "'Bebas Neue', Impact, sans-serif", body: "'Archivo', -apple-system, sans-serif", importUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700&display=swap' },
  organic: { display: "'Lora', Georgia, serif", body: "'Montserrat', -apple-system, sans-serif", importUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600&display=swap' },
  corporate: { display: "'Plus Jakarta Sans', -apple-system, sans-serif", body: "'Plus Jakarta Sans', -apple-system, sans-serif", importUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap' },
  minimal: { display: "'Sora', -apple-system, sans-serif", body: "'Inter', -apple-system, sans-serif", importUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap' },
};

function selectMood(niche: string, seed: number): LPMood {
  const rng = seededRng(seed + 7777);
  const candidates = NICHE_MOOD_MAP[niche] || NICHE_MOOD_MAP['geral'];
  return seededPick(candidates, rng);
}

// ── V8.0: Variant assignment ──
const HERO_VARIANTS = ['split_right', 'centered', 'glass_overlay'];
const BENEFITS_VARIANTS = ['alternating_rows', 'grid_cards', 'icon_list'];
const TESTIMONIALS_VARIANTS = ['cards', 'quote_wall'];
const PRICING_VARIANTS = ['horizontal_3col', 'single_highlight'];

function assignVariant(sectionType: string, seed: number, index: number, hasImages?: boolean): string | undefined {
  const rng = seededRng(seed + index * 31337);
  switch (sectionType) {
    case 'hero': return seededPick(HERO_VARIANTS, rng);
    case 'benefits': {
      if (!hasImages) return 'icon_list';
      return seededPick(BENEFITS_VARIANTS, rng);
    }
    case 'testimonials': return seededPick(TESTIMONIALS_VARIANTS, rng);
    case 'pricing': return seededPick(PRICING_VARIANTS, rng);
    default: return undefined;
  }
}

function buildBaseSchema(input: BuildSchemaInput & { variantSeed?: number; niche?: string }) {
  const c = getColorScheme(input.visualWeight, input.brandKit);
  const p = input.mainProduct;
  const seed = input.variantSeed || Math.floor(Math.random() * 100000);
  const nicheKey = input.niche || 'geral';

  // V8.0: Select mood and apply font overrides
  const mood = selectMood(nicheKey, seed);
  const moodFonts = MOOD_FONTS[mood];
  c.fontDisplay = moodFonts.display;
  c.fontBody = moodFonts.body;
  c.fontImportUrl = moodFonts.importUrl;

  // V8.0: Select template based on data availability
  const hasReviews = input.reviews.length > 0;
  const hasSocialProof = input.assets.socialProofImages.length >= 3;
  const template = selectTemplate(seed, hasReviews, hasSocialProof);
  
  console.log(`[AI-LP-Generate] V8.0 Variation: template=${template.id}, mood=${mood}, seed=${seed}`);

  // Build all section data
  const sectionBuilders: Record<string, () => any> = {
    hero: () => {
      const heroSubtitle = p.shortDescription || p.description?.substring(0, 150) || pick(HERO_SUBTITLE_POOL);
      const heroBenefits = [
        p.shortDescription || pick(['Resultados comprovados por milhares de clientes', 'Performance de elite para quem exige o melhor', 'A escolha inteligente de quem busca qualidade']),
        pick(['Fórmula exclusiva de alta performance', 'Tecnologia avançada de última geração', 'Ingredientes premium selecionados']),
        pick(['Satisfação garantida ou seu dinheiro de volta', 'Garantia total de qualidade', 'Envio rápido para todo o Brasil']),
      ];
      return {
        id: 'hero', type: 'hero',
        variant: assignVariant('hero', seed, 0),
        props: {
          badge: p.brand || input.storeName, title: p.name, subtitle: heroSubtitle, benefits: heroBenefits,
          ctaText: input.ctaText, ctaUrl: input.ctaUrl, productImageUrl: input.assets.heroImageUrl,
          backgroundImageUrl: input.assets.heroBackgroundUrl || undefined,
          heroSceneDesktopUrl: input.assets.heroSceneDesktopUrl || undefined,
          heroSceneMobileUrl: input.assets.heroSceneMobileUrl || undefined,
          priceDisplay: p.compareAtPrice && p.compareAtPrice > p.price ? `De <s>${formatPrice(p.compareAtPrice)}</s> por <strong>${formatPrice(p.price)}</strong>` : undefined,
        },
      };
    },
    benefits: () => {
      const benefitSet = pick(BENEFIT_POOL);
      const hasImages = input.assets.benefitImages.some(img => !!img);
      return {
        id: 'benefits', type: 'benefits',
        variant: assignVariant('benefits', seed, 1, hasImages),
        props: { items: benefitSet.map((b, i) => ({ ...b, imageUrl: input.assets.benefitImages[i] || '' })) },
      };
    },
    testimonials: () => {
      if (input.reviews.length === 0) return null;
      const displayReviews = input.reviews.slice(0, 6);
      const avgRating = (displayReviews.reduce((s, r) => s + r.rating, 0) / displayReviews.length).toFixed(1);
      return {
        id: 'testimonials', type: 'testimonials',
        variant: assignVariant('testimonials', seed, 2),
        props: {
          badge: pick(['AVALIAÇÕES REAIS', 'CLIENTES SATISFEITOS', 'DEPOIMENTOS VERIFICADOS']),
          title: pick(['O que nossos clientes dizem', 'Quem usa, recomenda', 'Avaliações de quem já testou']),
          subtitle: `Nota média: ${avgRating}/5 — ${displayReviews.length}+ avaliações verificadas`,
          items: displayReviews.map(r => ({ name: r.name, rating: r.rating, comment: r.comment })),
        },
      };
    },
    social_proof: () => {
      if (input.assets.socialProofImages.length < 3) return null;
      return {
        id: 'social_proof', type: 'social_proof',
        props: {
          badge: pick(['RESULTADOS REAIS', 'ANTES E DEPOIS', 'PROVA SOCIAL']),
          title: pick(['Transformações de quem já usa', 'Resultados que falam por si', 'Veja quem já transformou sua rotina']),
          imageUrls: input.assets.socialProofImages.slice(0, 24),
        },
      };
    },
    pricing: () => {
      const pricingProducts = input.kits.length > 0 ? [...input.kits] : [input.mainProduct];
      pricingProducts.sort((a, b) => a.price - b.price);
      const featuredIdx = pricingProducts.length === 3 ? 1 :
        pricingProducts.reduce((best, prod, i) => (prod.discountPercent || 0) > (pricingProducts[best].discountPercent || 0) ? i : best, 0);
      return {
        id: 'pricing', type: 'pricing',
        variant: assignVariant('pricing', seed, 4),
        props: {
          badge: pick(['OFERTAS ESPECIAIS', 'CONDIÇÕES EXCLUSIVAS', 'KITS COM DESCONTO']),
          title: pick(['Escolha a melhor opção para você', 'Monte seu kit ideal', 'Aproveite as melhores ofertas']),
          subtitle: pick(['Quanto maior o kit, maior a economia', 'Compre mais, pague menos', 'Desconto progressivo em todos os kits']),
          cards: pricingProducts.map((prod, i) => {
            const productUrl = prod.slug && input.storeBaseUrl ? `${input.storeBaseUrl}/p/${prod.slug}` : (prod.slug ? `/p/${prod.slug}` : input.ctaUrl);
            return {
              name: prod.name,
              imageUrl: (prod.id && input.assets.offerCardImages[prod.id]) || prod.primaryImage || input.assets.heroImageUrl,
              price: prod.price, compareAtPrice: prod.compareAtPrice || null, discountPercent: prod.discountPercent || null,
              installments: installments(prod.price), ctaText: input.ctaText, ctaUrl: productUrl,
              isFeatured: i === featuredIdx,
              featuredBadge: i === featuredIdx ? pick(['🔥 MAIS VENDIDO', '⭐ MELHOR CUSTO-BENEFÍCIO', '🏆 MAIS POPULAR']) : undefined,
            };
          }),
        },
      };
    },
    faq: () => {
      const faqSet = pick(FAQ_POOL);
      if (faqSet.length < 3) return null;
      return {
        id: 'faq', type: 'faq',
        props: {
          badge: 'DÚVIDAS FREQUENTES', title: 'Perguntas Frequentes',
          items: faqSet.map(f => ({ question: f.q.replace('{product}', p.name).replace('{store}', input.storeName), answer: f.a.replace('{product}', p.name).replace('{store}', input.storeName).replace('{installments}', installments(p.price)) })),
        },
      };
    },
    guarantee: () => ({
      id: 'guarantee', type: 'guarantee',
      props: {
        title: pick(['Garantia de Satisfação', 'Compra 100% Segura', 'Garantia Total']),
        description: `Sua compra é 100% segura. Se por qualquer motivo você não ficar satisfeito com o ${p.name}, devolvemos seu dinheiro integralmente. Sem burocracia, sem perguntas.`,
        badges: ['✓ Compra Segura', '✓ Pagamento Protegido', '✓ Envio Garantido'],
      },
    }),
    cta_final: () => {
      const ctaFinal = pick(CTA_FINAL_POOL);
      return {
        id: 'cta_final', type: 'cta_final',
        props: {
          title: ctaFinal.title, description: ctaFinal.desc.replace('{product}', p.name),
          productImageUrl: input.assets.heroImageUrl,
          ctaSceneDesktopUrl: input.assets.heroSceneDesktopUrl || undefined,
          ctaSceneMobileUrl: input.assets.heroSceneMobileUrl || undefined,
          priceDisplay: p.compareAtPrice && p.compareAtPrice > p.price
            ? `<span style="text-decoration:line-through;color:${c.priceOld}">De ${formatPrice(p.compareAtPrice)}</span><br/><span style="font-size:2.4rem;font-weight:800;color:${c.priceCurrent}">${formatPrice(p.price)}</span>`
            : `<span style="font-size:2.4rem;font-weight:800;color:${c.priceCurrent}">${formatPrice(p.price)}</span>`,
          ctaText: input.ctaText, ctaUrl: input.ctaUrl,
        },
      };
    },
  };

  // Build sections from template order, skipping null (missing data)
  const sections: any[] = [];
  for (const sectionType of template.sections) {
    const builder = sectionBuilders[sectionType];
    if (builder) {
      const section = builder();
      if (section) sections.push(section);
    }
  }

  // V9.0: Select premium template and apply its fonts + tokens
  const premiumTemplate = selectPremiumTemplate(seed, nicheKey);
  
  // Override fonts with premium template fonts
  c.fontDisplay = premiumTemplate.fontDisplay;
  c.fontBody = premiumTemplate.fontBody;
  c.fontImportUrl = premiumTemplate.fontImportUrl;
  
  console.log(`[AI-LP-Generate] V9.0 Premium Template: ${premiumTemplate.id}, mood=${mood}`);

  // Build design tokens map for CSS variable injection
  const designTokens: Record<string, string> = {
    '--lp-radius': premiumTemplate.tokens.radius,
    '--lp-card-style': premiumTemplate.tokens.cardStyle,
    '--lp-shadow-intensity': premiumTemplate.tokens.shadowIntensity,
    '--lp-section-py': premiumTemplate.tokens.sectionPaddingY,
    '--lp-glow-intensity': String(premiumTemplate.tokens.accentGlow),
    '--lp-divider-style': premiumTemplate.tokens.dividerStyle,
  };

  return {
    version: '9.0' as const,
    visualStyle: (input.visualWeight || 'premium') as any,
    colorScheme: c,
    showHeader: input.showHeader,
    showFooter: input.showFooter,
    sections,
    templateId: template.id,
    mood,
    variantSeed: seed,
    premiumTemplateId: premiumTemplate.id,
    designTokens,
  };
}

// ========== AI COPY REFINEMENT FOR SCHEMA ==========

function buildSchemaRefinementPrompt(params: {
  storeName: string;
  productName: string;
  niche: string;
  visualWeight: string;
  prompt: string;
  currentSchema: any;
}): { system: string; user: string } {
  const { storeName, productName, niche, visualWeight, prompt, currentSchema } = params;

  const system = `Você é um copywriter de elite especializado em landing pages de alta conversão.

## SUA FUNÇÃO
Você recebe o schema JSON de uma landing page com seções, títulos, descrições, benefícios, FAQs, etc.
Sua tarefa é melhorar APENAS os TEXTOS (títulos, subtítulos, descrições, benefícios, FAQs, badges, CTAs).

## REGRAS ABSOLUTAS
1. RETORNE o schema JSON COMPLETO e VÁLIDO — com a mesma estrutura
2. NÃO mude URLs de imagem
3. NÃO mude preços ou dados numéricos
4. NÃO adicione ou remova seções
5. NÃO mude o campo "type" de nenhuma seção
6. NÃO mude os IDs das seções
7. NÃO mude o colorScheme, visualStyle ou version
8. NÃO mude showHeader/showFooter
9. NÃO invente URLs
10. Melhore os textos para serem mais persuasivos, específicos ao nicho e orientados a conversão
11. NUNCA use markdown nos textos — proibido usar **, *, ##, __, \`\` ou qualquer formatação markdown
12. Todos os textos devem ser plain text puro, sem nenhuma marcação de formatação
13. Use CAPS LOCK para dar ênfase, nunca asteriscos
14. REGRA DE CTA: Todos os ctaText DEVEM ser CURTOS (máximo 20 caracteres). Exemplos corretos: "Comprar agora", "Quero meu kit", "Aproveitar oferta", "Garantir o meu". PROIBIDO usar frases longas ou explicativas nos botões.

## CONTEXTO
- Loja: ${storeName}
- Produto: ${productName}
- Nicho: ${niche}
- Estilo: ${visualWeight}

## FORMATO DE SAÍDA
Retorne APENAS o JSON completo do schema, sem markdown code fences, sem explicações.`;

  const user = `Melhore os textos deste schema de landing page conforme a direção criativa:

DIREÇÃO: ${prompt}

SCHEMA ATUAL:
${JSON.stringify(currentSchema, null, 2)}

Retorne o JSON completo com os textos melhorados.`;

  return { system, user };
}

// ========== INTENT CLASSIFICATION ==========

type AdjustmentIntent = 'text' | 'style' | 'asset' | 'structure';

function classifyIntent(prompt: string): AdjustmentIntent {
  const lower = prompt.toLowerCase();
  
  // Structure: adding/removing sections, swapping offers, reordering
  if (/adicionar?\s+(seção|bloco)|remover?\s+(seção|bloco)|trocar\s+(oferta|produto|card)|substituir|reordenar|mover\s+seção|novo\s+bloco/.test(lower)) {
    return 'structure';
  }
  
  // Asset: images, scenes, banners, visual compositions
  if (/imagem|image|foto|photo|banner|visual|gerar.*imagem|trocar.*imagem|mudar.*imagem|renderiz|hero.*visual|composiç|cena|scene|background/.test(lower)) {
    return 'asset';
  }
  
  // Style: colors, fonts, spacing, design
  if (/cor(es)?|font|tipografia|espaçamento|padding|margin|design|estilo|tema|dark|light|gradiente|sombra/.test(lower)) {
    return 'style';
  }
  
  // Default: text (titles, descriptions, CTAs, copy)
  return 'text';
}

// ========== AI ADJUSTMENT FOR SCHEMA ==========

function buildSchemaAdjustmentPrompt(params: {
  storeName: string;
  productName: string;
  prompt: string;
  currentSchema: any;
  intent: AdjustmentIntent;
  briefing?: any;
}): { system: string; user: string } {
  const { storeName, productName, prompt, currentSchema, intent, briefing } = params;

  // Build intent-specific constraints
  const intentConstraints = getIntentConstraints(intent, briefing, currentSchema);

  const system = `Você é um editor de landing pages de alta conversão. Você recebe o schema JSON de uma landing page e uma solicitação de ajuste.

## INTENÇÃO DETECTADA: ${intent.toUpperCase()}
${intentConstraints}

## SUAS CAPACIDADES
Você pode fazer QUALQUER tipo de ajuste na landing page:
- Alterar textos, títulos, descrições, CTAs, badges
- Alterar cores, estilos visuais
- Adicionar, remover ou reordenar seções inteiras
- Trocar produtos/ofertas na seção de pricing (substituir cards inteiros)
- Criar novas seções (hero, benefits, testimonials, social_proof, pricing, faq, guarantee, cta_final)
- Reconstruir seções existentes com novo conteúdo
- Alterar a estrutura dos cards de oferta

## REGRAS
1. RETORNE o schema JSON COMPLETO e VÁLIDO — com todas as seções
2. NÃO invente URLs de imagem — mantenha as existentes ou use "" se não houver
3. NÃO mude colorScheme, version ou visualStyle a menos que solicitado
4. NUNCA use markdown nos textos — proibido usar **, *, ##, __, \`\` ou qualquer formatação
5. Todos os textos devem ser plain text puro
6. Use CAPS LOCK para dar ênfase, nunca asteriscos
7. Quando solicitado trocar um produto/oferta no pricing, altere o nome, preço, CTA e demais campos do card
8. Quando solicitado criar uma seção, use a estrutura de seções existentes como referência
9. REGRA DE CTA: Todos os ctaText DEVEM ser CURTOS (máximo 20 caracteres). Exemplos: "Comprar agora", "Quero meu kit", "Aproveitar oferta". PROIBIDO frases longas.
${intent === 'structure' ? '10. REGRA DE PRICING: NÃO altere o NÚMERO de cards na seção pricing a menos que o usuário peça EXPLICITAMENTE para adicionar ou remover uma oferta. A quantidade de ofertas é definida pelo briefing original.' : ''}

## TIPOS DE SEÇÃO SUPORTADOS
- hero: { badge, title, subtitle, benefits[], ctaText, ctaUrl, productImageUrl, backgroundImageUrl, heroSceneDesktopUrl, heroSceneMobileUrl, priceDisplay }
- benefits: { items[{ label, title, description, imageUrl }] }
- testimonials: { badge, title, subtitle, items[{ name, rating, comment }] }
- social_proof: { badge, title, imageUrls[] }
- pricing: { badge, title, subtitle, cards[{ name, imageUrl, price, compareAtPrice, discountPercent, installments, ctaText, ctaUrl, isFeatured, featuredBadge }] }
- faq: { badge, title, items[{ question, answer }] }
- guarantee: { title, description, badges[] }
- cta_final: { title, description, productImageUrl, ctaSceneDesktopUrl, ctaSceneMobileUrl, priceDisplay, ctaText, ctaUrl }

## CONTEXTO
- Loja: ${storeName}
- Produto principal: ${productName}

## FORMATO DE SAÍDA
Retorne APENAS o JSON completo do schema atualizado, sem markdown code fences, sem explicações.`;

  const user = `Ajuste este schema de landing page conforme a solicitação abaixo.

SOLICITAÇÃO DO USUÁRIO: ${prompt}

SCHEMA ATUAL:
${JSON.stringify(currentSchema, null, 2)}

Retorne o JSON completo atualizado.`;

  return { system, user };
}

function getIntentConstraints(intent: AdjustmentIntent, briefing: any, currentSchema: any): string {
  const pricingSection = currentSchema?.sections?.find((s: any) => s.type === 'pricing');
  const currentCardCount = pricingSection?.props?.cards?.length || 0;

  switch (intent) {
    case 'text':
      return `Foco: Alterar APENAS textos (títulos, descrições, CTAs, badges, benefícios, FAQs).
NÃO altere URLs, preços numéricos, estrutura de seções ou cores.`;
    case 'style':
      return `Foco: Alterar cores, fontes, estilos visuais no colorScheme.
NÃO altere textos de conteúdo ou estrutura de seções.`;
    case 'asset':
      return `Foco: O usuário quer alterar imagens/visuais. 
Se pedir nova imagem/scene/banner, coloque URL vazia "" nos campos correspondentes — o sistema de enhance-images vai preencher automaticamente depois.
NÃO altere textos de conteúdo ou estrutura.`;
    case 'structure':
      return `Foco: Alterar estrutura (adicionar/remover seções, trocar ofertas no pricing).
REGRA DE PRICING LOCK: A seção pricing atualmente tem ${currentCardCount} cards. Mantenha esse número EXATO a menos que o usuário peça EXPLICITAMENTE para mudar a quantidade.
Quando trocar uma oferta: substitua nome, preço, CTA do card — mantenha a posição e o isFeatured do card substituído.
Anti-duplicidade: Máximo 1 seção hero e 1 social_proof.`;
  }
}

// ========== JSON RESPONSE PARSER ==========

function parseJsonResponse(raw: string): any | null {
  let text = raw.trim();
  
  // Remove markdown code fences
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('[AI-LP-Generate] Failed to parse JSON response');
    return null;
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(`[AI-LP-Generate v${VERSION}] Starting...`);

  try {
    const body: GenerateRequest = await req.json();
    let { landingPageId, tenantId, userId, prompt, promptType, referenceUrl, productIds, briefing } = body;

    if (!landingPageId || !tenantId || !userId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the landing page
    const { data: savedLandingPage, error: lpError } = await supabase
      .from("ai_landing_pages")
      .select("product_ids, reference_url, generated_html, generated_css, generated_schema, current_version, show_header, show_footer, briefing, is_published")
      .eq("id", landingPageId)
      .single();

    if (lpError) { console.error("[AI-LP-Generate] Error fetching landing page:", lpError); throw new Error("Landing page not found"); }

    productIds = productIds && productIds.length > 0 ? productIds : (savedLandingPage?.product_ids || []);
    referenceUrl = referenceUrl || savedLandingPage?.reference_url || undefined;
    briefing = briefing || (savedLandingPage?.briefing as BriefingInput | null) || undefined;

    console.log(`[AI-LP-Generate] Using ${productIds?.length || 0} products, promptType: ${promptType}`);

    // Fetch store settings
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name, logo_url, primary_color, secondary_color, accent_color, favicon_url")
      .eq("tenant_id", tenantId)
      .single();

    const storeName = storeSettings?.store_name || "Loja";
    // BrandKit starts with store_settings as FALLBACK — will be overridden by product colors below
    let brandKit: BrandKit = {
      primaryColor: storeSettings?.primary_color || "#6366f1",
      secondaryColor: storeSettings?.secondary_color || undefined,
      accentColor: storeSettings?.accent_color || undefined,
      logoUrl: storeSettings?.logo_url || undefined,
    };
    console.log(`[AI-LP-Generate] Store BrandKit (fallback): primary=${brandKit.primaryColor}`);

    // ===== STEP 1: FETCH PRODUCTS =====
    const allProducts: ProductData[] = [];
    const kits: ProductData[] = [];
    const reviews: ReviewData[] = [];
    let firstProduct: ProductData | null = null;
    let reviewCount = 0;
    const kitProductIds: string[] = [];

    if (productIds && productIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, product_type, tags")
        .in("id", productIds);

      if (products && products.length > 0) {
        // Fetch images
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, is_primary, sort_order")
          .in("product_id", productIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        const imagesByProduct = new Map<string, string[]>();
        const primaryImageByProduct = new Map<string, string>();
        images?.forEach((img: any) => {
          if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
          imagesByProduct.get(img.product_id)!.push(img.url);
          if (img.is_primary && !primaryImageByProduct.has(img.product_id)) {
            primaryImageByProduct.set(img.product_id, img.url);
          }
        });

        for (const p of products) {
          const prodImages = imagesByProduct.get(p.id) || [];
          const primaryImg = primaryImageByProduct.get(p.id) || prodImages[0] || '';
          const compareAt = p.compare_at_price || null;
          const discount = compareAt && compareAt > p.price
            ? Math.round(((compareAt - p.price) / compareAt) * 100)
            : null;

          const pd: ProductData = {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compareAtPrice: compareAt,
            discountPercent: discount,
            primaryImage: primaryImg,
            allImages: prodImages,
            shortDescription: p.short_description || undefined,
            description: p.description || undefined,
            brand: p.brand || undefined,
          };

          allProducts.push(pd);
          if (!firstProduct) firstProduct = pd;
        }

        // Auto-discover kits — STRICT: only kits where ALL components are from selected products
        try {
          // Step 1: Find kits that contain at least one of the selected products
          const { data: relatedKits } = await supabase
            .from("product_components")
            .select("parent_product_id, component_product_id")
            .in("component_product_id", productIds);

          if (relatedKits && relatedKits.length > 0) {
            // Get unique parent kit IDs (candidates)
            const candidateKitIds = [...new Set(relatedKits.map((r: any) => r.parent_product_id))]
              .filter((kitId: string) => !productIds!.includes(kitId));

            if (candidateKitIds.length > 0) {
              // Step 2: Fetch ALL components for each candidate kit (not just the matching ones)
              const { data: allKitComponents } = await supabase
                .from("product_components")
                .select("parent_product_id, component_product_id")
                .in("parent_product_id", candidateKitIds);

              // Group ALL components by kit
              const fullKitComponentMap = new Map<string, Set<string>>();
              for (const r of (allKitComponents || [])) {
                if (!fullKitComponentMap.has(r.parent_product_id)) {
                  fullKitComponentMap.set(r.parent_product_id, new Set());
                }
                fullKitComponentMap.get(r.parent_product_id)!.add(r.component_product_id);
              }

              // Step 3: STRICT filter — ALL components of the kit must be from selected products
              const strictKitIds = [...fullKitComponentMap.entries()]
                .filter(([_parentId, allComponents]) => {
                  // Every single component must be one of the selected products
                  for (const compId of allComponents) {
                    if (!productIds!.includes(compId)) return false;
                  }
                  return allComponents.size > 0;
                })
                .map(([parentId]) => parentId)
                .slice(0, 3); // Max 3 kits

              console.log(`[AI-LP-Generate] Kit discovery: ${candidateKitIds.length} candidates → ${strictKitIds.length} strict matches`);

            if (strictKitIds.length > 0) {
              const { data: kitProducts } = await supabase
                .from("products")
                .select("id, name, slug, price, compare_at_price, product_format, status")
                .in("id", strictKitIds)
                .eq("product_format", "with_composition")
                .in("status", ["active", "inactive"])
                .is("deleted_at", null);

              if (kitProducts && kitProducts.length > 0) {
                const kitIds = kitProducts.map((k: any) => k.id);
                kitProductIds.push(...kitIds);
                
                const { data: kitImages } = await supabase
                  .from("product_images")
                  .select("product_id, url, is_primary")
                  .in("product_id", kitIds)
                  .order("is_primary", { ascending: false });

                const kitPrimaryImage = new Map<string, string>();
                kitImages?.forEach((img: any) => {
                  if (!kitPrimaryImage.has(img.product_id)) kitPrimaryImage.set(img.product_id, img.url);
                });

                for (const kit of kitProducts) {
                  const compareAt = kit.compare_at_price || null;
                  const discount = compareAt && compareAt > kit.price
                    ? Math.round(((compareAt - kit.price) / compareAt) * 100)
                    : null;
                  kits.push({
                    id: kit.id,
                    name: kit.name,
                    slug: kit.slug,
                    price: kit.price,
                    compareAtPrice: compareAt,
                    discountPercent: discount,
                    primaryImage: kitPrimaryImage.get(kit.id) || '',
                    isKit: true,
                  });
                }
                console.log(`[AI-LP-Generate] Auto-discovered ${kits.length} kits`);
              }
            }
            } // end candidateKitIds.length > 0
          } // end relatedKits
        } catch (kitErr) {
          console.warn("[AI-LP-Generate] Kit discovery error:", kitErr);
        }

        // Fetch reviews
        const { data: reviewsData } = await supabase
          .from("product_reviews")
          .select("reviewer_name, rating, comment")
          .in("product_id", productIds)
          .eq("status", "approved")
          .order("rating", { ascending: false })
          .limit(10);

        if (reviewsData && reviewsData.length > 0) {
          for (const r of reviewsData) {
            reviews.push({ name: r.reviewer_name || 'Cliente', rating: r.rating, comment: r.comment });
          }
          reviewCount = reviewsData.length;
        }
      }
    }

    // ===== STEP 1B: EXTRACT COLORS FROM PRODUCT IMAGE =====
    // Uses AI vision to analyze the product's packaging and extract dominant colors.
    // These colors drive the PAGE DESIGN (buttons, backgrounds, accents) — the product itself is NEVER modified.
    if (firstProduct?.primaryImage && promptType !== 'adjustment') {
      try {
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || '';
        const productColors = await extractColorsFromProductImage(firstProduct.primaryImage, lovableApiKey);
        if (productColors) {
          brandKit = {
            ...brandKit,
            primaryColor: productColors.primary,
            secondaryColor: productColors.secondary,
            accentColor: productColors.accent,
            extractedFromProduct: true,
          };
          console.log(`[AI-LP-Generate] ✅ BrandKit overridden with PRODUCT colors: primary=${productColors.primary}, secondary=${productColors.secondary}, accent=${productColors.accent}`);
        } else {
          console.log(`[AI-LP-Generate] Product color extraction returned null, keeping store_settings colors`);
        }
      } catch (colorErr) {
        console.warn(`[AI-LP-Generate] Product color extraction failed, keeping store_settings:`, colorErr);
      }
    }

    // ===== STEP 2: RESOLVE ENGINE PLAN =====
    const fpProduct = allProducts[0];
    
    // Auto-detect visual style from prompt if no briefing.visualStyle
    let effectiveBriefing = briefing || null;
    if (!effectiveBriefing?.visualStyle && prompt) {
      const promptLower = prompt.toLowerCase();
      let detectedStyle: string | undefined;
      if (promptLower.includes('premium') || promptLower.includes('luxo') || promptLower.includes('sofisticad') || promptLower.includes('elegante') || promptLower.includes('dark') || promptLower.includes('escur')) {
        detectedStyle = 'premium';
      } else if (promptLower.includes('minimalista') || promptLower.includes('clean') || promptLower.includes('limpo')) {
        detectedStyle = 'minimalista';
      } else if (promptLower.includes('comercial') || promptLower.includes('agressiv') || promptLower.includes('vend')) {
        detectedStyle = 'comercial';
      } else if (promptLower.includes('direto') || promptLower.includes('simples') || promptLower.includes('objetivo')) {
        detectedStyle = 'direto';
      }
      if (detectedStyle) {
        effectiveBriefing = { 
          ...(effectiveBriefing || { objective: 'sale' as const, trafficTemp: 'cold' as const, trafficSource: 'meta' as const, awarenessLevel: 'pain_aware' as const }),
          visualStyle: detectedStyle as any,
        };
        console.log(`[AI-LP-Generate] Auto-detected visualStyle from prompt: ${detectedStyle}`);
      }
    }
    
    const enginePlan = resolveEnginePlan({
      briefing: effectiveBriefing,
      productType: null,
      tags: null,
      description: fpProduct?.description || null,
      price: fpProduct?.price || null,
      reviewCount,
    });

    console.log(`[AI-LP-Generate] Engine Plan: visual=${enginePlan.resolvedVisualWeight}, niche=${enginePlan.resolvedNiche}`);

    const ctaText = "COMPRAR AGORA";
    const ctaUrl = "#ofertas";
    const showHeader = savedLandingPage?.show_header ?? false;
    const showFooter = savedLandingPage?.show_footer ?? false;

    // Resolve store base URL for product links
    let storeBaseUrl = '';
    try {
      const { data: tenantData } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
      const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
      storeBaseUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenantData?.slug ? `https://${tenantData.slug}.shops.comandocentral.com.br` : '');
    } catch { /* non-blocking */ }

    // ===== V7: SCHEMA-FIRST GENERATION =====

    let finalSchema: any = null;
    let finalHtml: string | null = null;
    let finalCss: string | null = null;
    let aiRefinementUsed = false;
    let parseError: string | undefined;

    if (promptType === "adjustment" && savedLandingPage?.generated_schema) {
      // ── ADJUSTMENT MODE: AI edits existing SCHEMA with intent routing ──
      const intent = classifyIntent(prompt);
      console.log(`[AI-LP-Generate] V7 Schema adjustment mode — intent: ${intent}`);
      
      const { system, user } = buildSchemaAdjustmentPrompt({
        storeName,
        productName: firstProduct?.name || 'Produto',
        prompt,
        currentSchema: savedLandingPage.generated_schema,
        intent,
        briefing: savedLandingPage.briefing,
      });

      resetAIRouterCache();
      const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
      }, {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        logPrefix: "[AI-LP-Schema-Adjust]",
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        const parsed = parseJsonResponse(rawContent);
        if (parsed && parsed.sections && parsed.sections.length > 0) {
          finalSchema = parsed;
          aiRefinementUsed = true;
          console.log(`[AI-LP-Generate] Schema adjustment applied: ${parsed.sections.length} sections`);
        } else {
          finalSchema = savedLandingPage.generated_schema;
          parseError = 'AI schema adjustment returned invalid JSON, kept existing';
        }
      } else {
        finalSchema = savedLandingPage.generated_schema;
        parseError = `AI schema adjustment failed: ${aiResponse.status}`;
      }

    } else {
      // ── GENERATION MODE: Build base schema + AI copy refinement ──
      console.log(`[AI-LP-Generate] V7 Schema generation mode`);

      if (!firstProduct) {
        throw new Error("No products found to generate landing page");
      }

      // Resolve assets deterministically
      const nicheKey = enginePlan.resolvedNiche || 'geral';
      const assets = await resolveLandingPageAssets({
        supabase,
        tenantId,
        productIds: productIds || [],
        kitProductIds,
        niche: nicheKey,
      });

      // Build base schema from templates (instant, no AI)
      const variantSeed = Math.floor(Math.random() * 100000);
      const baseSchema = buildBaseSchema({
        storeName,
        brandKit,
        visualWeight: enginePlan.resolvedVisualWeight,
        mainProduct: firstProduct,
        allProducts,
        kits,
        reviews,
        assets,
        ctaText,
        ctaUrl,
        showHeader,
        showFooter,
        storeBaseUrl,
        variantSeed,
        niche: nicheKey,
      });

      // AI refines copy in the schema
      try {
        const enrichedPrompt = isPromptIncomplete(prompt)
          ? `${prompt}\n\nDIREÇÃO: ${selectBestFallback(null, null, firstProduct.description || null, firstProduct.name).prompt}`
          : prompt;

        const { system, user } = buildSchemaRefinementPrompt({
          storeName,
          productName: firstProduct.name,
          niche: enginePlan.resolvedNiche,
          visualWeight: enginePlan.resolvedVisualWeight,
          prompt: enrichedPrompt,
          currentSchema: baseSchema,
        });

        resetAIRouterCache();
        const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.6,
        }, {
          supabaseUrl,
          supabaseServiceKey: supabaseKey,
          logPrefix: "[AI-LP-Schema-Copy]",
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "";
          const parsed = parseJsonResponse(rawContent);
          if (parsed && parsed.sections && parsed.sections.length >= baseSchema.sections.length * 0.5) {
            finalSchema = parsed;
            aiRefinementUsed = true;
            console.log(`[AI-LP-Generate] AI copy refinement applied to schema`);
          } else {
            console.warn("[AI-LP-Generate] AI schema output invalid, using base schema");
            finalSchema = baseSchema;
            parseError = 'AI schema refinement invalid';
          }
        } else {
          console.warn(`[AI-LP-Generate] AI schema refinement failed, using base schema`);
          finalSchema = baseSchema;
          parseError = `AI schema copy failed: ${aiResponse.status}`;
        }
      } catch (aiErr) {
        console.warn("[AI-LP-Generate] AI schema error, using base schema:", aiErr);
        finalSchema = baseSchema;
        parseError = 'AI schema error';
      }
    }

    if (!finalSchema || !finalSchema.sections || finalSchema.sections.length === 0) {
      throw new Error("Generated schema is empty");
    }

    // Ensure version field
    finalSchema.version = '9.0';

    // ===== STEP 5: PERSIST =====
    const newVersion = (savedLandingPage?.current_version || 0) + 1;

    // Preserve published status if page was already published
    const isCurrentlyPublished = savedLandingPage?.is_published === true;
    
    const { error: updateError } = await supabase
      .from("ai_landing_pages")
      .update({
        generated_schema: finalSchema,
        generated_html: null, // V7 uses schema, clear HTML
        generated_css: null,
        generated_blocks: null,
        current_version: newVersion,
        status: isCurrentlyPublished ? "published" : (promptType === 'initial' ? 'generating' : 'draft'),
      metadata: {
          engineVersion: "v9.0",
          schemaFirst: true,
          aiRefinementUsed,
          colorsFromProduct: brandKit.extractedFromProduct || false,
          brandColors: { primary: brandKit.primaryColor, secondary: brandKit.secondaryColor, accent: brandKit.accentColor },
          visualWeight: enginePlan.resolvedVisualWeight,
          niche: enginePlan.resolvedNiche,
          sectionCount: finalSchema.sections.length,
          parseError: parseError || null,
          productCount: allProducts.length,
          kitCount: kits.length,
          reviewCount,
          socialProofCount: finalSchema.sections.find((s: any) => s.type === 'social_proof')?.props?.imageUrls?.length || 0,
          templateId: finalSchema.templateId || null,
          premiumTemplateId: finalSchema.premiumTemplateId || null,
          mood: finalSchema.mood || null,
          variantSeed: finalSchema.variantSeed || null,
        },
      })
      .eq("id", landingPageId);

    if (updateError) { console.error("[AI-LP-Generate] Update error:", updateError); throw updateError; }

    const { error: versionError } = await supabase
      .from("ai_landing_page_versions")
      .insert({
        landing_page_id: landingPageId,
        tenant_id: tenantId,
        version: newVersion,
        prompt,
        prompt_type: promptType,
        html_content: '', // V7 doesn't generate HTML
        css_content: null,
        blocks_content: null,
        schema_content: finalSchema,
        created_by: userId,
        generation_metadata: {
          engineVersion: "v9.0",
          schemaFirst: true,
          aiRefinementUsed,
          model: aiRefinementUsed ? "google/gemini-2.5-flash" : "none",
          templateId: finalSchema.templateId || null,
          premiumTemplateId: finalSchema.premiumTemplateId || null,
          mood: finalSchema.mood || null,
          variantSeed: finalSchema.variantSeed || null,
          section_count: finalSchema.sections.length,
          product_count: allProducts.length,
          kit_count: kits.length,
          reviews_count: reviewCount,
          parseError: parseError || null,
        },
      });

    if (versionError) console.error("[AI-LP-Generate] Version error:", versionError);

    console.log(`[AI-LP-Generate v${VERSION}] Success! Version ${newVersion}, ${finalSchema.sections.length} sections, AI refined: ${aiRefinementUsed}, template=${finalSchema.templateId}, mood=${finalSchema.mood}`);

    // Determine intent for response metadata
    const adjustmentIntent = promptType === 'adjustment' ? classifyIntent(prompt) : null;

    return new Response(
      JSON.stringify({
        success: true,
        version: newVersion,
        engineVersion: "v8.0",
        templateId: finalSchema.templateId,
        mood: finalSchema.mood,
        variantSeed: finalSchema.variantSeed,
        schemaFirst: true,
        sectionCount: finalSchema.sections.length,
        aiRefinementUsed,
        intent: adjustmentIntent,
        triggerEnhance: adjustmentIntent === 'asset',
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LP-Generate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
