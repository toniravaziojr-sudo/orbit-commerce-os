

# Plano: Motor Inteligente de Roteamento por Tipo de Criativo (Imagem + Vídeo)

## Problema Central

O sistema hoje tem modelos fixos por módulo, sem inteligência de roteamento. O usuário escreve um prompt e o sistema usa sempre o mesmo modelo, independente do tipo de conteúdo que o prompt pede. Cada modelo tem pontos fortes diferentes, e o sistema deveria escolher automaticamente o melhor para cada caso.

## Como Funciona Hoje vs. Como Deveria Funcionar

**Hoje:** Usuário escolhe tier manualmente (Premium/Áudio/Econômico) → sistema sempre usa Kling I2V para vídeo, Lovable Gateway para imagem no estúdio.

**Proposta:** Usuário escreve o prompt → sistema classifica a intenção → escolhe o melhor modelo → fallback por qualidade se falhar.

## Mapa de Modelos: Melhor IA Para Cada Tipo

### Imagens (Motor Único v10 — já implementado, apenas alinhar Estúdio)

| Tipo de Imagem | Melhor Modelo | Por Quê |
|---|---|---|
| Produto com fidelidade (rótulo, embalagem) | GPT Image 1 (fal.ai) | Edit-image preserva referência |
| Cenário lifestyle / pessoa com produto | Gemini Pro Image | Composição realista de cenas |
| Promocional / efeitos visuais | GPT Image 1 → Gemini | Composição + fidelidade |
| Fundo / ambiente sem produto | Gemini Flash Image | Rápido, sem necessidade de referência |

### Vídeos (NOVO motor unificado)

| Tipo de Vídeo | Melhor Modelo | Por Quê | Fallback |
|---|---|---|---|
| Produto girando / showcase | **Kling v3 Pro I2V** | Melhor fidelidade de produto em movimento | Wan 2.6 I2V |
| Pessoa usando produto (UGC) | **Kling v3 Pro I2V** (keyframe GPT Image) | Composição pessoa+produto | Wan 2.6 |
| Vídeo com narração / áudio | **Veo 3.1** | Único com áudio nativo | Kling + F5-TTS |
| Vídeo de texto/prompt puro (sem referência) | **Veo 3.1** | Text-to-video nativo | Wan 2.6 T2V |
| Teste / rascunho rápido | **Wan 2.6 I2V** | Custo baixo, resultado aceitável | — |

## Arquitetura: Classificador de Intenção

Criar um classificador leve que analisa o prompt do usuário e determina:

```text
Prompt do Usuário
       ↓
 [Classificador de Intenção]
       ↓
 intent: product_showcase | ugc_scene | narrated | text_only | draft
       ↓
 [Seletor de Modelo] → melhor modelo para o intent
       ↓
 [Execução com Fallback por Qualidade]
```

O classificador usa regras simples (palavras-chave) — sem IA para classificar:
- "girando", "rotação", "showcase", "360" → `product_showcase` → Kling v3
- "pessoa", "segurando", "usando", "UGC" → `ugc_scene` → Kling v3 + keyframe
- "narração", "fala", "áudio", "voz" → `narrated` → Veo 3.1
- sem imagem de referência → `text_only` → Veo 3.1
- "teste", "rascunho", "rápido" → `draft` → Wan 2.6

Se o usuário não der pistas, o sistema usa `product_showcase` (Kling v3) como default quando tem imagem de referência, ou `text_only` (Veo 3.1) quando não tem.

## Implementação em 6 Passos

### Passo 1 — Motor Único de Vídeo (`_shared/video-engine.ts`)

Criar `resilientVideoGenerate()` com:
- Classificador de intenção por keywords no prompt
- Cascata de fallback por qualidade (Kling → Veo → Wan)
- Parâmetros: `prompt`, `referenceImageUrl`, `duration`, `aspectRatio`, `timeoutMs`
- Retorno: `{ videoUrl, provider, model, intent, fallbackReason }`

### Passo 2 — Integrar nos Consumidores de Vídeo

- **Estúdio de Criativos** (`creative-process`): Remover lógica local de `submitFalJob`, importar motor unificado. Remover seleção manual de tier — o motor decide pelo prompt.
- **Calendário** (`media-generate-video`): Substituir referência a Sora 2 pelo motor unificado.
- **Gestor de Tráfego** (`ads-autopilot-creative-generate`): Adicionar suporte a vídeo invocando o motor unificado.
- **Desbloquear hook** (`useCreatives.ts`): Remover trava "temporariamente desativada" (linha 203).

### Passo 3 — Alinhar Imagens no Estúdio de Criativos

Refatorar `ImageGenerationTabV3`:
- Remover `ProviderSelector`, `StyleSelector`, `StyleFields`
- UI simplificada: Produto + Prompt + Formato + Quantidade
- Invocar `creative-image-generate` (motor único v10 já implementado)

### Passo 4 — UI do Vídeo: Prompt-First

Simplificar `VideoGeneratorForm`:
- Remover seleção manual de tier (Premium/Áudio/Econômico)
- Manter: Produto + Prompt + Duração + Formato
- O motor decide automaticamente o melhor modelo pelo prompt

### Passo 5 — Deploy e Validação Técnica

- Deploy de todas as edge functions afetadas
- Verificar logs (sem erros de import)
- Build do frontend
- Testar classificação de intenção com prompts reais

### Passo 6 — Documentação

Atualizar memórias do sistema com a nova arquitetura unificada.

## Arquivos Impactados

**Novo:**
- `supabase/functions/_shared/video-engine.ts` — Motor único de vídeo

**Modificados:**
- `supabase/functions/creative-process/index.ts` — Importar motor unificado para vídeos
- `supabase/functions/media-generate-video/index.ts` — Substituir Sora 2
- `supabase/functions/ads-autopilot-creative-generate/index.ts` — Adicionar vídeo
- `src/hooks/useCreatives.ts` — Desbloquear vídeo
- `src/components/creatives/image-generation/ImageGenerationTabV3.tsx` — Prompt-only
- `src/components/creatives/video-forms/VideoGeneratorForm.tsx` — Remover tier manual

**Removidos:**
- `src/components/creatives/image-generation/ProviderSelector.tsx`
- `src/components/creatives/image-generation/StyleSelector.tsx`
- `src/components/creatives/image-generation/StyleFields.tsx`

## Resultado Esperado

- Um único motor para vídeo, um único motor para imagens
- Sem seleção manual de modelo/tier/estilo — tudo pelo prompt
- Classificação automática de intenção para escolher o melhor modelo
- Fallback por qualidade se o modelo ideal falhar
- Observabilidade: `intent`, `selectedModel`, `actualProvider`, `fallbackReason`

