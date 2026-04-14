# Memory: features/ai/image-generation-hierarchy-standard
Updated: 2026-04-14

O sistema de geração de imagens utiliza um MOTOR ÚNICO centralizado em `_shared/visual-engine.ts` → `resilientGenerate()`, consumido por TODOS os módulos (Produtos, Banners, Calendário, Landing Pages, Criativos).

Hierarquia de provedores OBRIGATÓRIA e INVIOLÁVEL:
1. **GPT Image 1 edit-image (fal.ai)** — `fal-ai/gpt-image-1/edit-image`, chamada síncrona via `fal.run()`. Timeout: 60s. Aceita `image_urls` + prompt.
2. **Gemini Nativa** — API direta, `GEMINI_API_KEY` via `platform_credentials`. Referência base64.
3. **OpenAI Nativa** — API direta, `OPENAI_API_KEY`. Chat Completions com `modalities: ['image', 'text']`.
4. **Lovable AI Gateway** — ÚLTIMO RECURSO. `LOVABLE_API_KEY`.

**REGRA CRÍTICA**: Nenhum módulo possui implementação local de fallback. Todos importam de `_shared/visual-engine.ts`.

**UI**: Sem seletores de estilo. Geração dirigida exclusivamente pelo prompt + imagem de referência + descrição do produto.
