# Memory: features/ai/image-generation-hierarchy-standard
Updated: now

O sistema de geração de imagens (Cadastro de Produtos, Estúdio Criativo, Gestor de Tráfego IA, Landing Pages, Construtor de Lojas e Blocos Visuais) segue uma hierarquia de provedores OBRIGATÓRIA e INVIOLÁVEL:

1. **GPT Image 1 edit-image (fal.ai)** — `fal-ai/gpt-image-1/edit-image`, usa `FAL_API_KEY`. Provedor PRIORITÁRIO para todos os cenários com imagem de referência (produto, criativo, etc). Aceita `image_urls` + prompt, gerando variações FIÉIS ao produto real. **Timeout: 60s** (reduzido de 120s para acelerar fallback).
2. **Gemini Nativa** — chamada direta à API do Google AI Studio (`generativelanguage.googleapis.com`), usando `GEMINI_API_KEY` da `platform_credentials`. Fallback com referência base64. Recebe o MESMO prompt criativo completo + imagem de referência do produto.
3. **OpenAI Nativa** — chamada direta à API da OpenAI (`api.openai.com`), usando `OPENAI_API_KEY`. Fallback com referência base64. Recebe o MESMO prompt criativo completo + imagem de referência do produto.
4. **Lovable AI Gateway** — ÚLTIMO RECURSO de fallback, usando `LOVABLE_API_KEY`. Recebe prompt + referência base64.

**REGRA CRÍTICA**: TODOS os níveis de fallback DEVEM receber a imagem real do produto como referência. O produto com fidelidade visual é inegociável — sem ele, a imagem não serve para o e-commerce. Nenhum fallback pode gerar imagem genérica sem o produto.

**IMPORTANTE**: O FLUX 2 Pro/Turbo (text-to-image puro) foi REMOVIDO do pipeline de imagens pois não aceita imagem de referência, gerando produtos genéricos.

O módulo compartilhado `_shared/fal-client.ts` centraliza a função `generateImageWithGptImage1()`. O módulo `_shared/native-gemini.ts` centraliza as chamadas nativas ao Gemini. O `_shared/visual-engine.ts` orquestra a hierarquia completa via `resilientGenerate()`.
