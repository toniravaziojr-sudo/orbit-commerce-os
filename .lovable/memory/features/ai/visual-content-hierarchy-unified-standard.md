# Memory: features/ai/visual-content-hierarchy-unified-standard
Updated: 2026-04-14

Hierarquia Unificada de Geração de Imagens (v10.0 — Final): O sistema utiliza um motor único centralizado em `resilientGenerate()` (`_shared/visual-engine.ts`) para TODOS os módulos. Não existem implementações locais de fallback.

1. **Cascata**: GPT Image 1 (fal.ai, síncrono 60s) → Gemini Nativa → OpenAI Nativa → Lovable Gateway.
2. **Prompt**: Direções criativas do usuário + descrição completa do produto + imagem de referência. Sem seletores de estilo.
3. **Parâmetros**: `outputSize`, `styleReferences`, `timeoutMs` configuráveis por módulo.
4. **Observabilidade**: `actualProvider` e `external_model_id` registrados em `creative_jobs`.
5. **Consumidores**: `creative-image-generate`, `media-process-generation-queue`, `ai-landing-page-enhance-images`, blocos visuais via `_shared/visual-engine.ts`.
