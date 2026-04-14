# Memory: features/ai/unified-image-engine-v10
Updated: 2026-04-14

## Motor Único de Geração de Imagens (v10.0)

### Arquitetura
Um único `resilientGenerate()` centralizado em `supabase/functions/_shared/visual-engine.ts` serve TODOS os módulos do sistema. Nenhum módulo possui implementação local de fallback.

### Cascata de Fallback (ordem obrigatória)
1. **GPT Image 1 (fal.ai)** — `fal-ai/gpt-image-1/edit-image`, chamada síncrona via `fal.run()` com timeout de 60s. Aceita `image_urls` + prompt. Prioridade máxima.
2. **Gemini Nativa** — API direta `generativelanguage.googleapis.com`, `GEMINI_API_KEY` via `platform_credentials`. Referência em base64.
3. **OpenAI Nativa** — API direta `api.openai.com`, `OPENAI_API_KEY`. Modelo `gpt-image-1` via Chat Completions com `modalities: ['image', 'text']`.
4. **Lovable AI Gateway** — Último recurso. Modelos: `google/gemini-3-pro-image-preview` → `google/gemini-2.5-flash-image`.

### Parâmetros Unificados
- `prompt` — Direção criativa do usuário (OBRIGATÓRIO)
- `referenceImageUrl` — URL da imagem de referência do produto
- `outputSize` — Dimensões da imagem (default `1024x1024`)
- `styleReferences` — Imagens de referência de estilo adicionais (landing pages)
- `timeoutMs` — Timeout configurável (default 60s)

### Módulos Consumidores
| Módulo | Edge Function | outputSize | Extras |
|--------|--------------|------------|--------|
| Cadastro de Produtos | `creative-image-generate` | `1024x1024` | Descrição completa do produto no prompt |
| Blocos Visuais (Banners) | via `_shared/visual-engine.ts` | Dimensões do slot | — |
| Calendário de Conteúdo | `media-process-generation-queue` | `1024x1024` | — |
| Landing Pages | `ai-landing-page-enhance-images` | `1536x1024` | `styleReferences` |
| Estúdio de Criativos | `creative-image-generate` | `1024x1024` | — |

### Observabilidade
Todos os módulos registram `actualProvider` e `external_model_id` para auditoria de qual motor efetivamente gerou a imagem e por que houve fallback.

### UI de Produtos
- Sem seletor de estilo — geração dirigida exclusivamente pelo prompt do usuário
- Descrição completa do produto injetada automaticamente no contexto do prompt
- Imagem principal do produto enviada como referência visual obrigatória
- Botão de geração sempre habilitado (até 5 imagens por request)

### Módulos Compartilhados
- `_shared/visual-engine.ts` — Motor único com `resilientGenerate()`
- `_shared/fal-client.ts` — Cliente fal.ai com `generateImageWithGptImage1()` (síncrono)
- `_shared/native-gemini.ts` — Chamadas nativas ao Gemini
- `_shared/creative-brief-builder.ts` — Construção de prompts

### Proibições
- ❌ Implementações locais de fallback em edge functions
- ❌ FLUX 2 Pro/Turbo (text-to-image sem referência)
- ❌ Seletores de estilo pré-definidos na UI
- ❌ Geração sem imagem de referência do produto
- ❌ Lovable Gateway como primeira opção
