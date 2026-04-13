# Memory: features/ai/image-generation-hierarchy-standard
Updated: now

O sistema de geração de imagens (Cadastro de Produtos, Estúdio Criativo, Gestor de Tráfego IA, Landing Pages, Construtor de Lojas e Blocos Visuais) segue uma hierarquia de provedores OBRIGATÓRIA e INVIOLÁVEL:

1. **GPT Image 1 edit-image (fal.ai)** — `fal-ai/gpt-image-1/edit-image`, usa `FAL_API_KEY`. Provedor PRIORITÁRIO para todos os cenários com imagem de referência (produto, criativo, etc). Aceita `image_urls` + prompt, gerando variações FIÉIS ao produto real.
2. **Gemini Nativa** — chamada direta à API do Google AI Studio (`generativelanguage.googleapis.com`), usando `GEMINI_API_KEY` da `platform_credentials`. Fallback com referência base64.
3. **OpenAI Nativa** — chamada direta à API da OpenAI (`api.openai.com`), usando `OPENAI_API_KEY`. Fallback com referência base64.
4. **Lovable AI Gateway** — ÚLTIMO RECURSO de fallback, usando `LOVABLE_API_KEY`.

**IMPORTANTE**: O FLUX 2 Pro/Turbo (text-to-image puro) foi REMOVIDO do pipeline de imagens pois não aceita imagem de referência, gerando produtos genéricos. Todos os fluxos do sistema e-commerce requerem fidelidade à imagem real do produto.

O módulo compartilhado `_shared/fal-client.ts` centraliza a função `generateImageWithGptImage1()`. O módulo `_shared/native-gemini.ts` centraliza as chamadas nativas ao Gemini.
