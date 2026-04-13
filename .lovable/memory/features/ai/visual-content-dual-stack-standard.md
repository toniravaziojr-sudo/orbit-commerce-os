# Memory: features/ai/visual-content-dual-stack-standard
Updated: now

Arquitetura de Geração de Conteúdo Visual (v9.0 — GPT Image 1 Priority):

## IMAGENS (v9.0) — Hierarquia obrigatória em TODOS os pipelines:
1. **GPT Image 1 edit-image (fal.ai)** — Principal. Image-to-image com referência fiel (~$0.167/img 1024x1024). Model ID: `fal-ai/gpt-image-1/edit-image`. Aceita `image_urls` + prompt.
2. **Gemini Nativa** — Fallback seguro (API direta, GEMINI_API_KEY, referência base64)
3. **OpenAI Nativa** — Fallback seguro (gpt-image-1 direto, OPENAI_API_KEY, referência base64)
4. **Lovable AI Gateway** — Último recurso (créditos da workspace)

**REMOVIDO**: FLUX 2 Pro/Turbo foi eliminado do pipeline de imagens. Motivo: modelo text-to-image puro que não aceita imagem de referência, gerando produtos genéricos. Todos os fluxos do e-commerce exigem fidelidade à imagem real do produto.

**Pipelines alinhados:**
- `creative-image-generate` v8.0 ✅
- `_shared/visual-engine.ts` v3.0 ✅
- `media-process-generation-queue` v9.0 ✅
- `ai-landing-page-enhance-images` v6.0 ✅

## VÍDEOS (v3.0) — Pipeline fal.ai (sem alteração):
- **Premium**: Kling v3 Pro I2V (melhor fidelidade de produto, ~$0.56/5s)
- **Áudio Nativo**: Veo 3.1 (qualidade cinema com áudio, ~$1.00/5s)
- **Econômico**: Wan 2.6 I2V (custo reduzido, ~$0.50/5s)
- **Fallback**: Imagem estática via stack de imagens (Gemini/OpenAI/Gateway)

**Pipeline:** `creative-video-generate` v3.0 ✅

## Frontend:
- `UnifiedVideoTab.tsx` — Seletor simplificado sem tipos legados
- `VideoGeneratorForm.tsx` — Formulário unificado com seletor de tier/duração/formato
- `AIImageGeneratorDialog.tsx` — Suporta campo de prompt direcional opcional

## Módulo compartilhado:
- `_shared/fal-client.ts` — Cliente centralizado para imagens (GPT Image 1 + FLUX 2 legado para vídeo context) e vídeos (Kling/Veo/Wan)
- Função `generateImageWithGptImage1()` — Nova função para image-to-image

## Credenciais:
- `FAL_API_KEY` — platform_credentials (obrigatória para pipeline principal)
- `GEMINI_API_KEY` — platform_credentials (fallback seguro)
- `OPENAI_API_KEY` — secrets (fallback seguro)
- `LOVABLE_API_KEY` — automática (último recurso)

## Armazenamento:
- Vídeos: rota `Criativos IA/Vídeos` no Drive
- Vídeos Calendário: rota `Criativos IA/Vídeos Calendário` no Drive
