# Memory: features/ai/visual-content-hierarchy-unified-standard
Updated: 2026-04-14

Hierarquia Unificada de Geração Visual (v10.0 — Imagens + Vídeos):

## Imagens
Motor único `resilientGenerate()` em `_shared/visual-engine.ts`. Cascata: GPT Image 1 (fal.ai, síncrono 60s) → Gemini Nativa → OpenAI Nativa → Lovable Gateway. Sem seletores de estilo/provedor.

## Vídeos
Motor único `resilientVideoGenerate()` em `_shared/video-engine.ts`. Classificador de intenção por keywords no prompt → seleção automática do melhor modelo:
- **product_showcase/ugc_scene** → Kling v3 Pro I2V → Wan 2.6 (fallback)
- **narrated/text_only** → Veo 3.1 → Kling/Wan (fallback)
- **draft** → Wan 2.6 direto

## Princípios Comuns
1. **Prompt-only**: Direções criativas do usuário + descrição do produto + imagem de referência. Sem seletores manuais.
2. **Fallback por qualidade**: Cada modelo tem fallback para o próximo na cascata.
3. **Observabilidade**: `intent`, `selectedModel`, `actualProvider`, `fallbackReason` registrados para auditoria.
4. **Consumidores**: `creative-image-generate`, `creative-process`, `media-generate-video`, `media-process-generation-queue`, `ai-landing-page-enhance-images`, blocos visuais.
