

# Diagnóstico Honesto: O que aconteceu e como resolver

## O Problema Real (sem rodeios)

O Motor V5 foi construído com uma premissa que parece boa na teoria mas falha na prática:

**A IA gera JSON estruturado que mapeia para componentes React genéricos do Builder.**

O resultado é previsível: os componentes `TestimonialsBlock`, `PricingTableBlock`, `FAQBlock` etc. foram desenhados para **lojas e-commerce comuns** (com Tailwind utilitário básico, `py-8 container mx-auto px-4`). Eles **nunca** foram desenhados para páginas de vendas de alta conversão com visual premium.

### O que aconteceu passo a passo:

1. **Motor V4 funcionava** -- a IA gerava HTML/CSS livre, com total controle sobre layout, cores, tipografia, sombras, gradientes. O resultado era renderizado em iframe isolado. Tinha liberdade criativa total.

2. **Problema de timeout** -- gerar HTML + imagens na mesma chamada estourava os 150s. Solução correta: separar em etapas.

3. **Decisão errada** -- ao separar em etapas, mudamos **também** o formato de saída de HTML livre para JSON/blocos. Isso não era necessário para resolver o timeout. Misturamos dois problemas.

4. **Resultado** -- a IA agora está presa a ~14 componentes genéricos com props fixas. Ela não pode controlar:
   - Gradientes de fundo sofisticados
   - Tipografia premium (Playfair Display, letter-spacing)
   - Layouts assimétricos ou criativos
   - Efeitos visuais (glass, blur, sombras profundas)
   - Espaçamentos personalizados por seção
   - Cores por seção (cada bloco herda o Tailwind padrão)

5. **Os bugs (`.map is not a function`, dados como object)** são sintomas secundários -- a IA tenta encaixar conteúdo rico em props que não foram feitas para isso.

### Resumo brutal:
> O Motor V5 transforma um diretor criativo (IA com HTML livre) num operário de linha de montagem (IA preenchendo formulários de props). O resultado visual é inferior por design, não por bug.

---

## A Solução Correta

O timeout era o único problema real. A solução é **manter HTML livre + resolver o timeout separadamente**:

### Plano: Motor V5.4 (HTML Livre + Timeout Resolvido)

```text
┌─────────────────────────────────────────────┐
│  ETAPA 1: ai-landing-page-generate          │
│  IA gera HTML/CSS COMPLETO (como V4)        │
│  Usa imagens do catálogo (sem gerar novas)  │
│  Tempo: ~30-60s (cabe nos 150s)             │
│  Salva em: generated_html + generated_css   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  ETAPA 2: ai-landing-page-enhance-images    │
│  (já existe, mantém chunking por timeout)   │
│  Gera imagens premium assíncronamente       │
│  Substitui URLs no HTML salvo               │
│  Tempo: ~30s por imagem, recursivo          │
└─────────────────────────────────────────────┘
```

### O que muda concretamente:

1. **Edge Function `ai-landing-page-generate`**: Volta a pedir HTML/CSS livre para a IA (como V4), mas **sem** gerar imagens (isso resolve o timeout). A IA usa as imagens do catálogo diretamente.

2. **Renderização**: Volta para iframe com `wrapInDocumentShell()` (já existe no código, linhas 429-533). A pipeline de shell, CSS utilities e safety CSS **já está pronta**.

3. **Editor e Preview**: Prioriza `generated_html` com iframe. O código do `LandingPageEditor.tsx` e `StorefrontAILandingPage.tsx` já tem o fallback para iframe -- basta inverter a prioridade.

4. **Enhance Images (Etapa 2)**: Continua igual -- busca seções do HTML, gera composições visuais premium, substitui as URLs. O chunking por timeout já funciona.

5. **Blocos V5 mantidos para o Builder**: Os componentes JSON/React continuam existindo para o Builder visual da loja. Eles simplesmente não são usados para landing pages de IA.

### O que NÃO muda:
- Auto-descoberta de kits (STEP 1B) -- mantida
- Busca de provas sociais do Drive (STEP 3) -- mantida  
- Engine Plan (archetype, niche, depth) -- mantido
- CTA constraints no CSS -- mantidas
- Header/Footer governance -- mantida

### Arquivos afetados:

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-landing-page-generate/index.ts` | Prompt volta a pedir HTML livre; salva em `generated_html` + `generated_css` em vez de `generated_blocks` |
| `src/pages/LandingPageEditor.tsx` | Prioridade: `generated_html` (iframe) > `generated_blocks` (blocos) |
| `src/pages/storefront/StorefrontAILandingPage.tsx` | Idem -- prioriza HTML no iframe |
| `src/components/landing-pages/LandingPagePreviewDialog.tsx` | Idem |

### Por que isso vai funcionar:
- O Motor V4 **já produzia resultados bons** -- o HTML livre dá à IA controle total
- O timeout é resolvido pela separação generate/enhance que **já existe**
- A pipeline de shell/safety/CSS utilities **já está implementada** (linhas 429-533)
- Não há componente novo para criar -- é reverter a decisão errada e manter a infraestrutura certa

### Estimativa: 
- 1 mudança na Edge Function (prompt + formato de saída)
- 3 mudanças em componentes React (inverter prioridade de renderização)
- Zero tabelas novas, zero componentes novos

---

## Resposta direta à sua pergunta

> Vamos conseguir desenvolver algo realmente bom aqui?

Sim. O motor de geração de HTML livre já funcionava. O erro foi trocar o formato de saída (de HTML para JSON/blocos) junto com a solução de timeout, quando eram problemas independentes. A correção é cirúrgica: desfazer a troca de formato, manter a solução de timeout.

