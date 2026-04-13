# Memory: features/ai/image-generation-native-priority-v9
Updated: now

## HIERARQUIA OBRIGATÓRIA DE PROVEDORES DE IMAGEM (v9.0 — INVIOLÁVEL)

**Ordem de prioridade para TODOS os sistemas que geram imagens:**

### 1. GPT Image 1 edit-image via fal.ai (PRIORIDADE MÁXIMA)
- Model ID: `fal-ai/gpt-image-1/edit-image`
- **Image-to-image**: Aceita `image_urls` (URLs de referência) + prompt
- Gera variações FIÉIS ao produto real
- Usa `FAL_API_KEY` obtida via `getFalApiKey()` de `platform_credentials`
- Módulo: `supabase/functions/_shared/fal-client.ts` → `generateImageWithGptImage1()`
- Custo: ~$0.167 por imagem 1024x1024

### 2. Gemini Nativa (FALLBACK)
- Chamada direta à API `generativelanguage.googleapis.com/v1beta`
- **NÃO** passa pelo Lovable AI Gateway
- Usa `GEMINI_API_KEY` obtida via `getCredential()` da tabela `platform_credentials`
- Aceita referência em base64
- Módulo compartilhado: `supabase/functions/_shared/native-gemini.ts`

### 3. OpenAI Nativa (FALLBACK)
- Chamada direta à API `api.openai.com/v1/chat/completions`
- Usa `OPENAI_API_KEY` (env var)
- Modelo: `gpt-image-1` via Chat Completions API com `modalities: ['image', 'text']`
- **PROIBIDO:** Usar Images API legacy (`/v1/images/*`)

### 4. Lovable AI Gateway (ÚLTIMO RECURSO)
- Só é usado quando TODOS os anteriores falharem
- Gateway URL: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Modelos: `google/gemini-3-pro-image-preview` → `google/gemini-2.5-flash-image`
- Usa `LOVABLE_API_KEY` (gerenciada automaticamente)

## REMOVIDO (v9.0)
- ❌ **FLUX 2 Pro/Turbo** — Removido do pipeline de imagens. Modelo text-to-image puro que NÃO aceita imagem de referência, resultando em produtos genéricos. Incompatível com e-commerce.

## Sistemas Afetados (TODOS seguem esta hierarquia — TODOS ALINHADOS ✅)
- `supabase/functions/creative-image-generate/index.ts` v8.0.0 ✅
- `supabase/functions/media-process-generation-queue/index.ts` v9.0.0 ✅
- `supabase/functions/ai-landing-page-enhance-images/index.ts` v6.0.0 ✅
- `supabase/functions/_shared/visual-engine.ts` v3.0.0 ✅

## Checklist Anti-Regressão (OBRIGATÓRIO antes de qualquer mudança)
- [x] GPT Image 1 edit-image é SEMPRE o primeiro provedor tentado (quando há referência)
- [x] GPT Image 1 recebe a URL da imagem de referência via `image_urls`
- [x] Gemini Nativa é o SEGUNDO provedor tentado
- [x] OpenAI é o TERCEIRO provedor tentado
- [x] Lovable AI Gateway é SEMPRE o ÚLTIMO recurso
- [x] `_shared/fal-client.ts` contém `generateImageWithGptImage1()`
- [x] Fallback Drive (por product_id) funciona antes do catálogo no creative-image-generate
- [x] TODOS os 4 pipelines estão alinhados à hierarquia v9.0

## PROIBIÇÕES ABSOLUTAS
- ❌ NUNCA usar FLUX 2 Pro/Turbo para geração de imagens (não suporta referência)
- ❌ NUNCA usar Lovable Gateway como primeira opção de geração
- ❌ NUNCA chamar a API do Gemini via Gateway quando a chave nativa está disponível
- ❌ NUNCA usar a Images API legacy da OpenAI (`/v1/images/*`)
