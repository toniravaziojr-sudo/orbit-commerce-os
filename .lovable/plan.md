

# Plano: Motor Único de Geração de Imagens

## Problema Atual

Existem **4 cópias** da mesma cascata de fallback espalhadas pelo sistema, cada uma com pequenas diferenças que causam inconsistências:

| Local | Função | Diferenças |
|-------|--------|------------|
| `_shared/visual-engine.ts` | `resilientGenerate()` | Usado só por banners/builder. Tem timeout de 70s no Gateway, etapa "simplified prompt" |
| `creative-image-generate` | `resilientGenerate()` (local) | Usado por thumbs de produto. Cópia quase idêntica mas sem timeout no Gateway |
| `media-process-generation-queue` | `resilientGenerateMedia()` (local) | Usado pelo calendário. Reimplementa OpenAI inline em vez de usar `generateWithRealOpenAI()` |
| `ai-landing-page-enhance-images` | `callImageModel()` (local) | Landing pages. Pula OpenAI inteiramente, usa size `1536x1024` |

O resultado: quando um módulo funciona bem (ex: banners), outro falha (ex: thumbs de produto) porque cada um tem sua própria implementação.

## O Que Cada Um Tem de Bom

- **visual-engine.ts**: Timeout com fallback automático, QA scorer, upload integrado, prompt builder centralizado (`creative-brief-builder.ts`)
- **creative-image-generate**: Tracking de `actualProvider` e `external_model_id` para diagnóstico
- **media-process-generation-queue**: Fallback limpo sem timeout excessivo
- **ai-landing-page-enhance-images**: Suporte a `styleReferences` adicionais e tamanho dinâmico

## Solução: Um Único `resilientGenerate()` em `_shared/visual-engine.ts`

### Passo 1 — Expandir a assinatura do `resilientGenerate` compartilhado

Adicionar parâmetros opcionais para cobrir todos os casos:

- `outputSize` — tamanho da imagem (default `1024x1024`, landing pages usam `1536x1024`, banners usam dimensões do slot)
- `styleReferences` — imagens de referência de estilo adicionais (landing pages)
- `timeoutMs` — timeout configurável por chamador (default 60s para GPT Image 1)

A cascata unificada fica:
1. **GPT Image 1 (fal.ai)** — com `referenceImageUrl` + prompt + `outputSize`
2. **Gemini Nativa** — com referência base64 + prompt completo
3. **OpenAI Nativa** — com referência base64 + prompt completo (usando `generateWithRealOpenAI` já existente)
4. **Lovable Gateway Pro** — com referência base64 + timeout
5. **Lovable Gateway Flash** — fallback rápido
6. **Lovable Gateway Simplified** — último recurso com prompt simplificado

Retorno padronizado com `actualProvider`, `model`, `fallbackReason`.

### Passo 2 — Eliminar as cópias locais

- **`creative-image-generate`**: Remover `resilientGenerate()` local (~80 linhas). Importar de `_shared/visual-engine.ts`.
- **`media-process-generation-queue`**: Remover `resilientGenerateMedia()` local (~130 linhas). Importar de `_shared/visual-engine.ts`.
- **`ai-landing-page-enhance-images`**: Remover `callImageModel()` local (~65 linhas). Importar de `_shared/visual-engine.ts`.

### Passo 3 — Cada módulo passa seus diferenciais como parâmetros

| Módulo | outputSize | Referência | Extra |
|--------|-----------|------------|-------|
| Thumbs produto (1:1) | `1024x1024` | URL do produto | — |
| Banners desktop | `1536x640` (do slot) | URL do produto | — |
| Banners mobile | `640x800` (do slot) | URL do produto | — |
| Landing pages | `1536x1024` | URL do produto | `styleReferences` |
| Calendário | `1024x1024` | URL do produto | — |
| Criativos | `1024x1024` | URL do produto | — |

### Passo 4 — Prompt: apenas o prompt direciona a IA

O `creative-brief-builder.ts` já existe e já prioriza o briefing do usuário. Vamos garantir que:
- O estilo (`product_natural`, `person_interacting`, `promotional`) se torna **opcional** — se o usuário não escolher, a IA interpreta pelo prompt
- O briefing/prompt do usuário é SEMPRE a direção primária
- O produto + referência visual são SEMPRE enviados

### Passo 5 — Fix do bug de quantidade

Corrigir a lógica de `maxImages` no `AIImageGeneratorDialog.tsx` para mostrar mensagem "Limite atingido" quando `maxImages <= 0`.

### Passo 6 — Deploy e validação

Redeployar as 4 edge functions afetadas e validar nos logs que todas usam o mesmo caminho.

## Detalhes Técnicos

**Arquivos modificados:**
1. `supabase/functions/_shared/visual-engine.ts` — Expandir `resilientGenerate()` com novos parâmetros opcionais
2. `supabase/functions/creative-image-generate/index.ts` — Remover `resilientGenerate()` local, importar do shared
3. `supabase/functions/media-process-generation-queue/index.ts` — Remover `resilientGenerateMedia()` local, importar do shared
4. `supabase/functions/ai-landing-page-enhance-images/index.ts` — Remover `callImageModel()` local, importar do shared
5. `src/components/products/AIImageGeneratorDialog.tsx` — Fix bug quantidade + tornar estilo opcional

**Resultado esperado:**
- Um único motor para todo o sistema
- Mesma cascata de fallback em todos os módulos
- Diagnóstico unificado (qual motor venceu, por que houve fallback)
- Prompt como direção única, sem depender de seleção de estilo

