# Memory: features/ai/image-generation-hierarchy-standard
Updated: now

O sistema de geração de imagens (Calendário de Conteúdo, Estúdio Criativo, Landing Pages, Construtor de Lojas e Blocos Visuais) segue uma hierarquia de provedores OBRIGATÓRIA e INVIOLÁVEL:

1. **Gemini Nativa** — chamada direta à API do Google AI Studio (`generativelanguage.googleapis.com`), usando `GEMINI_API_KEY` da `platform_credentials`. NÃO passa pelo Lovable Gateway.
2. **OpenAI Nativa** — chamada direta à API da OpenAI (`api.openai.com`), usando `OPENAI_API_KEY`.
3. **Lovable AI Gateway** — ÚLTIMO RECURSO de fallback, usando `LOVABLE_API_KEY`.

Esta ordem prioriza o consumo de créditos próprios do cliente e garante independência do saldo da workspace Lovable. O módulo compartilhado `_shared/native-gemini.ts` centraliza as chamadas nativas ao Gemini.
