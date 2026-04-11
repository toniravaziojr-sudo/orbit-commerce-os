# Memory: features/ai/visual-content-dual-stack-standard
Updated: 2026-04-11

Arquitetura de Geração de Conteúdo Visual (v8.0 — Dual Stack fal.ai + Fallback):

1. **Dual-Stack**: fal.ai como provedor principal, stack nativa (Gemini/OpenAI/Lovable Gateway) como fallback seguro.

2. **IMAGENS (v8.0)**:
   - (1) fal.ai FLUX 2 Pro [Principal — melhor fotorrealismo, ~$0.03/img]
   - (2) fal.ai FLUX 2 Turbo [Fallback rápido — ~$0.008/img]
   - (3) Gemini Nativa [Fallback seguro]
   - (4) OpenAI Nativa gpt-image-1 [Fallback secundário]
   - (5) Lovable Gateway [Último recurso]
   - Sistemas integrados: creative-image-generate, media-process-generation-queue, ai-landing-page-enhance-images, visual-engine.ts, ai-block-fill-visual

3. **VÍDEOS (v3.0 — fal.ai Pipeline)**:
   - Premium: Kling v3 Pro I2V (~$0.42/5s) — Melhor fidelidade de produto
   - Com Áudio Nativo: Veo 3.1 (~$0.75/5s) — Qualidade cinema
   - Econômico: Wan 2.6 I2V (~$0.15/5s) — Custo reduzido para escala
   - Lipsync: Kling Lipsync (~$0.07) — Pós-processamento com TTS ElevenLabs
   - Fallback: Imagem estática via stack de imagens

4. **Frontend**: VideoGeneratorForm unificado substitui 4 formulários antigos (UGCReal, UGCAI, ProductVideo, AvatarMascot). Seletor de produto + tier + duração + formato + narração.

5. **Edge Functions**:
   - `_shared/fal-client.ts` — Cliente centralizado (queue + poll + result)
   - `creative-video-generate` — Pipeline fal.ai para Estúdio (v3.0)
   - `creative-image-generate` — Hierarquia v8.0 com fal.ai
   - `media-process-generation-queue` — Hierarquia v8.0 para Calendário
   - `ai-landing-page-enhance-images` — Hierarquia v4.0 com fal.ai

6. **Drive**: Rotas `ai_creative_video` e `ai_creative_video_calendar` adicionadas ao FOLDER_ROUTES.

7. **Credenciais**: FAL_API_KEY via platform_credentials (painel Integrações → IA).
