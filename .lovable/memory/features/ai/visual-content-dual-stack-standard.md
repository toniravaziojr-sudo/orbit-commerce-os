# Memory: features/ai/visual-content-dual-stack-standard
Updated: now

Arquitetura de Geração de Conteúdo Visual (v8.0 — Dual Stack fal.ai + Fallback Seguro):

## IMAGENS (v7.0) — Hierarquia obrigatória em TODOS os pipelines:
1. **fal.ai FLUX 2 Pro** — Principal (melhor fotorrealismo, ~$0.03/img)
2. **fal.ai FLUX 2 Turbo** — Fallback rápido (~$0.008/img)
3. **Gemini Nativa** — Fallback seguro (API direta, GEMINI_API_KEY)
4. **OpenAI Nativa** — Fallback seguro (gpt-image-1, OPENAI_API_KEY)
5. **Lovable AI Gateway** — Último recurso (créditos da workspace)

**Pipelines alinhados:**
- `creative-image-generate` v7.0 ✅
- `_shared/visual-engine.ts` v2.1 ✅
- `media-process-generation-queue` v8.0 ✅
- `ai-landing-page-enhance-images` v5.0 ✅

## VÍDEOS (v3.0) — Pipeline fal.ai:
- **Premium**: Kling v3 Pro I2V (melhor fidelidade de produto, ~$0.56/5s)
- **Áudio Nativo**: Veo 3.1 (qualidade cinema com áudio, ~$1.00/5s)
- **Econômico**: Wan 2.6 I2V (custo reduzido, ~$0.50/5s)
- **Fallback**: Imagem estática via stack de imagens (Gemini/OpenAI/Gateway)

**Pipeline:** `creative-video-generate` v3.0 ✅

## Frontend:
- `UnifiedVideoTab.tsx` — Seletor simplificado sem tipos legados
- `VideoGeneratorForm.tsx` — Formulário unificado com seletor de tier/duração/formato

## Módulo compartilhado:
- `_shared/fal-client.ts` — Cliente centralizado para imagens (FLUX 2) e vídeos (Kling/Veo/Wan)

## Credenciais:
- `FAL_API_KEY` — platform_credentials (obrigatória para pipeline principal)
- `GEMINI_API_KEY` — platform_credentials (fallback seguro)
- `OPENAI_API_KEY` — secrets (fallback seguro)
- `LOVABLE_API_KEY` — automática (último recurso)

## Armazenamento:
- Vídeos: rota `Criativos IA/Vídeos` no Drive
- Vídeos Calendário: rota `Criativos IA/Vídeos Calendário` no Drive
