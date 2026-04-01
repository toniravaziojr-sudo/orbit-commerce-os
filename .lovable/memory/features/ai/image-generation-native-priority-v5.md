# Memory: features/ai/image-generation-native-priority-v6
Updated: now

## HIERARQUIA OBRIGATÓRIA DE PROVEDORES DE IMAGEM (v6.0 — INVIOLÁVEL)

**Ordem de prioridade para TODOS os sistemas que geram imagens:**

### 1. Gemini Nativa (PRIORIDADE MÁXIMA)
- Chamada direta à API `generativelanguage.googleapis.com/v1beta`
- **NÃO** passa pelo Lovable AI Gateway
- Usa `GEMINI_API_KEY` obtida via `getCredential()` da tabela `platform_credentials`
- Modelo: `gemini-2.5-flash-image` com `responseModalities: ['TEXT', 'IMAGE']`
- Módulo compartilhado: `supabase/functions/_shared/native-gemini.ts`

### 2. OpenAI Nativa
- Chamada direta à API `api.openai.com/v1/chat/completions`
- Usa `OPENAI_API_KEY` (env var)
- Modelo: `gpt-image-1` via Chat Completions API com `modalities: ['image', 'text']`
- **PROIBIDO:** Usar Images API legacy (`/v1/images/*`)

### 3. Lovable AI Gateway (ÚLTIMO RECURSO — FALLBACK)
- Só é usado quando Gemini Nativa E OpenAI falharem
- Gateway URL: `https://ai.gateway.lovable.dev/v1/chat/completions`
- Modelos: `google/gemini-3-pro-image-preview` → `google/gemini-3.1-flash-image-preview` → `google/gemini-2.5-flash-image`
- Usa `LOVABLE_API_KEY` (gerenciada automaticamente)

## Sistemas Afetados (TODOS seguem esta hierarquia)
- `supabase/functions/creative-image-generate/index.ts` — Criativos de anúncios (v6.0.0)
- `supabase/functions/media-process-generation-queue/index.ts` — Calendário de conteúdo (v7.0.0)
- `supabase/functions/ai-landing-page-enhance-images/index.ts` — Landing Pages (v3.0.0)
- `supabase/functions/_shared/visual-engine.ts` — Construtor de Lojas (v2.1.0+)
- `supabase/functions/ai-block-fill-visual/index.ts` — Blocos visuais (v3.0.0+)

## Módulo Compartilhado: `_shared/native-gemini.ts`
- `generateWithNativeGemini()` — chamada direta ao Google AI Studio
- `tryNativeGemini()` — wrapper com retry no modelo fallback
- Importado por todos os sistemas acima

## Checklist Anti-Regressão (OBRIGATÓRIO antes de qualquer mudança)
- [ ] Gemini Nativa é SEMPRE o primeiro provedor tentado
- [ ] Gemini Nativa usa API DIRETA (`generativelanguage.googleapis.com`), NÃO o Lovable Gateway
- [ ] `GEMINI_API_KEY` é obtida via `getCredential()` de `platform_credentials`
- [ ] OpenAI é o SEGUNDO provedor tentado
- [ ] Lovable AI Gateway é SEMPRE o ÚLTIMO recurso (fallback)
- [ ] Nenhum sistema usa o Gateway como primeira opção
- [ ] `_shared/native-gemini.ts` é o módulo compartilhado para chamadas nativas
- [ ] Fallback Drive (por product_id) funciona antes do catálogo no creative-image-generate

## PROIBIÇÕES ABSOLUTAS
- ❌ NUNCA usar Lovable Gateway como primeira opção de geração
- ❌ NUNCA remover ou rebaixar a prioridade da Gemini Nativa
- ❌ NUNCA chamar a API do Gemini via Gateway quando a chave nativa está disponível
- ❌ NUNCA usar a Images API legacy da OpenAI (`/v1/images/*`)
