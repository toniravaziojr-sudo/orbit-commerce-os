# Memory: features/ai/image-generation-native-priority-v10
Updated: 2026-04-14

## HIERARQUIA OBRIGATÓRIA DE PROVEDORES DE IMAGEM (v10.0 — Motor Único)

**Motor centralizado**: `_shared/visual-engine.ts` → `resilientGenerate()`
**Nenhum módulo possui implementação local de fallback.**

### 1. GPT Image 1 edit-image via fal.ai (PRIORIDADE MÁXIMA)
- Model ID: `fal-ai/gpt-image-1/edit-image`
- Chamada síncrona via `fal.run()` com timeout de 60s
- Aceita `image_urls` + prompt para fidelidade absoluta
- Usa `FAL_API_KEY` via `platform_credentials`

### 2. Gemini Nativa (FALLBACK)
- API direta `generativelanguage.googleapis.com/v1beta`
- `GEMINI_API_KEY` via `platform_credentials`
- Referência em base64

### 3. OpenAI Nativa (FALLBACK)
- API direta `api.openai.com/v1/chat/completions`
- `OPENAI_API_KEY` (env var)
- Modelo `gpt-image-1` com `modalities: ['image', 'text']`

### 4. Lovable AI Gateway (ÚLTIMO RECURSO)
- `https://ai.gateway.lovable.dev/v1/chat/completions`
- Modelos: `google/gemini-3-pro-image-preview` → `google/gemini-2.5-flash-image`

## Módulos Consumidores (TODOS usam motor único ✅)
- `creative-image-generate` ✅
- `media-process-generation-queue` ✅
- `ai-landing-page-enhance-images` ✅
- `_shared/visual-engine.ts` (motor) ✅

## PROIBIÇÕES
- ❌ Implementações locais de fallback
- ❌ FLUX 2 Pro/Turbo
- ❌ Seletores de estilo na UI
- ❌ Geração sem referência do produto
- ❌ Gateway como primeira opção
