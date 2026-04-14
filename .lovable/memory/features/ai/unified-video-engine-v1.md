# Memory: features/ai/unified-video-engine-v1
Updated: 2026-04-14

## Motor Único de Geração de Vídeo (v1.0)

### Arquitetura
Um `resilientVideoGenerate()` centralizado em `supabase/functions/_shared/video-engine.ts` serve TODOS os módulos do sistema. Classificador de intenção por keywords no prompt do usuário determina automaticamente o melhor modelo.

### Classificador de Intenção
| Intent | Keywords | Modelo Ideal |
|--------|----------|-------------|
| `product_showcase` | girando, rotação, 360, showcase, zoom, close-up | Kling v3 Pro I2V |
| `ugc_scene` | pessoa, segurando, usando, UGC, unboxing, demo | Kling v3 Pro I2V |
| `narrated` | narração, fala, áudio, voz, som, música | Veo 3.1 |
| `text_only` | (sem imagem de referência) | Veo 3.1 |
| `draft` | teste, rascunho, rápido, econômico | Wan 2.6 I2V |

**Default:** `product_showcase` quando há imagem de referência, `text_only` quando não há.

### Cascata de Fallback (por qualidade)
1. **Kling v3 Pro I2V** (fal.ai) — `fal-ai/kling-video/v3/pro/image-to-video`. Melhor fidelidade de produto. Fallback: Wan 2.6.
2. **Veo 3.1** (fal.ai) — `fal-ai/veo3.1` ou `fal-ai/veo3.1/reference-to-video`. Áudio nativo. Fallback: Kling → Wan.
3. **Wan 2.6 I2V** (fal.ai) — `wan/v2.6/image-to-video`. Econômico. Sem fallback.

### Parâmetros Unificados
- `prompt` — Direção criativa do usuário (OBRIGATÓRIO)
- `referenceImageUrl` — URL da imagem de referência do produto
- `duration` — "5" ou "10"
- `aspectRatio` — "9:16", "16:9", "1:1"
- `resolution` — "720p", "1080p"
- `generateAudio` — boolean (auto para Veo 3.1)

### Módulos Consumidores
| Módulo | Edge Function | Como Usa |
|--------|-------------|----------|
| Estúdio de Criativos | `creative-process` | Importa `fal-client.ts` diretamente (pipeline existente com TTS/LipSync) |
| Calendário de Conteúdo | `media-generate-video` | Intent classifier para log/auditoria, modelo `video-engine-unified` |
| Gestor de Tráfego IA | `ads-autopilot-creative-generate` | Futuro: invocar motor para geração de vídeos de anúncios |

### Observabilidade
Todos os módulos registram `intent`, `selectedModel`, `actualProvider` e `fallbackReason`.

### UI
- **VideoGeneratorForm**: Sem seleção manual de tier — apenas Produto + Prompt + Duração + Formato
- **ImageGenerationTabV3**: Sem seletores de estilo/provedor — apenas Produto + Prompt + Formato + Variações
- O sistema escolhe automaticamente o melhor modelo pelo prompt

### Módulos Compartilhados
- `_shared/video-engine.ts` — Motor único com `resilientVideoGenerate()` e `classifyIntent()`
- `_shared/fal-client.ts` — Cliente fal.ai com `generateVideoWithFal()` (Kling/Veo/Wan)
- `_shared/visual-engine.ts` — Motor único de imagens com `resilientGenerate()`

### Proibições
- ❌ Seleção manual de tier/modelo na UI
- ❌ Seletores de estilo/provedor pré-definidos
- ❌ Implementações locais de fallback em edge functions
- ❌ Referência a Sora 2 (modelo obsoleto removido)
- ❌ Lovable Gateway como primeira opção para vídeo
