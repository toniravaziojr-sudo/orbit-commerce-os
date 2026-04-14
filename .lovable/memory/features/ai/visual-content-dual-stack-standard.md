# Memory: features/ai/visual-content-dual-stack-standard
Updated: 2026-04-14

Arquitetura de Geração de Conteúdo Visual (v10.0 — Motor Único):

## IMAGENS (v10.0) — Motor único em `_shared/visual-engine.ts`:
Cascata: GPT Image 1 (fal.ai, síncrono) → Gemini Nativa → OpenAI Nativa → Lovable Gateway.
Nenhum módulo tem implementação local. Todos importam `resilientGenerate()`.

**UI**: Sem seletores de estilo. Prompt + referência + descrição do produto.

## VÍDEOS (v3.0) — Pipeline fal.ai (sem alteração):
- **Premium**: Kling v3 Pro I2V (~$0.56/5s)
- **Áudio Nativo**: Veo 3.1 (~$1.00/5s)
- **Econômico**: Wan 2.6 I2V (~$0.50/5s)
- **Fallback**: Imagem estática

## Credenciais:
- `FAL_API_KEY` — platform_credentials (pipeline principal)
- `GEMINI_API_KEY` — platform_credentials (fallback)
- `OPENAI_API_KEY` — secrets (fallback)
- `LOVABLE_API_KEY` — automática (último recurso)
