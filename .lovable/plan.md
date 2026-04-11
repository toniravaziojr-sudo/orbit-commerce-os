

# Plano: Stack Dupla fal.ai (Titular) + Stack Atual (Fallback) — Imagens e Vídeos

## Resumo

Reestruturar toda a geração visual (imagens e vídeos) para usar **fal.ai como provedor principal** e manter a **stack atual como fallback seguro**. Isso se aplica ao Estúdio de Criativos e ao Calendário de Conteúdo.

---

## Stack Definitiva

### IMAGENS

| Prioridade | Provedor | Modelo | Custo/img | Quando usa |
|------------|----------|--------|-----------|------------|
| **1. Principal** | fal.ai | FLUX 2 Pro (com referência) | ~$0.03 | Sempre tenta primeiro |
| **2. Principal fallback** | fal.ai | FLUX 2 Turbo | ~$0.008 | Se Pro falhar |
| **3. Fallback seguro** | Gemini Nativa | gemini-2.5-flash-image | ~$0.04 | Se fal.ai inteira falhar |
| **4. Fallback secundário** | OpenAI Nativa | gpt-image-1 | ~$0.04-0.08 | Se Gemini falhar |
| **5. Último recurso** | Lovable Gateway | gemini-3-pro-image-preview | créditos | Se tudo falhar |

**Por que FLUX 2 Pro?** Melhor fotorrealismo da categoria, aceita imagem de referência (image-to-image), custo 30% menor que Gemini, e controle total de parâmetros (guidance_scale, steps, seed).

### VÍDEOS

| Prioridade | Provedor | Modelo | Custo/5s | Quando usa |
|------------|----------|--------|----------|------------|
| **1. Premium** | fal.ai | Kling v3 Pro I2V | ~$0.42 | Padrão com imagem de produto |
| **2. Com áudio nativo** | fal.ai | Veo 3.1 | ~$0.75 | Quando narração nativa ativada |
| **3. Econômico** | fal.ai | Wan 2.6 I2V | ~$0.15 | Modo econômico / testes A/B |
| **4. Lipsync** | fal.ai | Kling Lipsync | ~$0.07 | Pós-processamento com TTS |
| **5. TTS** | ElevenLabs (direto) | Multilingual v2 | ~$0.04 | Narração PT-BR |
| **Fallback vídeo** | Lovable Gateway | gemini-3-pro-image-preview → frame animation | créditos | Se fal.ai falhar completamente |

**Fallback de vídeo**: Se a fal.ai estiver indisponível, o sistema gera uma **imagem estática** via stack atual (Gemini/OpenAI/Gateway) e informa ao usuário que o vídeo não pôde ser gerado, oferecendo a imagem como alternativa. Isso garante que o usuário nunca fique sem conteúdo.

---

## O que será feito

### Fase 1: Módulo compartilhado fal.ai

Criar `supabase/functions/_shared/fal-client.ts` — módulo centralizado para todas as chamadas à fal.ai:
- `generateImageWithFal()` — FLUX 2 Pro/Turbo para imagens
- `generateVideoWithFal()` — Kling/Veo/Wan para vídeos
- `applyLipsyncWithFal()` — Kling Lipsync pós-processamento
- Tratamento de polling (fal.ai usa queue → poll → result)
- Timeout e retry configuráveis

### Fase 2: Reescrever pipeline de imagens

**`creative-image-generate/index.ts`** — Alterar `resilientGenerate()`:
```
NOVA HIERARQUIA:
1. fal.ai FLUX 2 Pro (com imagem referência) ← NOVO
2. fal.ai FLUX 2 Turbo (fallback rápido) ← NOVO
3. Gemini Nativa (fallback seguro — stack atual)
4. OpenAI Nativa (fallback seguro)
5. Lovable Gateway (último recurso)
```

**`media-process-generation-queue/index.ts`** — Mesma hierarquia para o Calendário.

**Sistemas afetados** (todos passam a usar a mesma hierarquia):
- `creative-image-generate` — Estúdio de Criativos
- `media-process-generation-queue` — Calendário de Conteúdo
- `ai-landing-page-enhance-images` — Landing Pages
- `_shared/visual-engine.ts` — Construtor de Lojas
- `ai-block-fill-visual` — Blocos visuais

### Fase 3: Novo sistema de vídeos

**Remover formulários antigos:**
- `UGCRealForm.tsx`, `UGCAIForm.tsx`, `ProductVideoForm.tsx`, `AvatarMascotForm.tsx`
- Referências a Runway, HeyGen, Akool nos tipos e hooks

**Criar formulário unificado:**
- `VideoGeneratorForm.tsx` — Interface única com:
  - Seletor de produto (obrigatório no Estúdio)
  - Prompt descritivo
  - Tier: Premium (Kling) | Com áudio (Veo 3.1) | Econômico (Wan)
  - Duração: 5s | 10s
  - Formato: 9:16 | 16:9 | 1:1
  - Toggle narração PT-BR (ElevenLabs + Lipsync)

**Reescrever edge functions de vídeo:**
- `creative-video-generate/index.ts` — Pipeline fal.ai para Estúdio
- `media-generate-video/index.ts` — Pipeline fal.ai para Calendário
- Ambos usam `_shared/fal-client.ts`

### Fase 4: Drive — Separação de vídeos

Adicionar rotas no `FOLDER_ROUTES`:
```
ai_creative_video: 'Criativos IA/Vídeos'
ai_creative_video_calendar: 'Criativos IA/Vídeos Calendário'
```

### Fase 5: Limpeza e documentação

- Remover `creative-generate/index.ts` e `creative-process/index.ts` (pipeline legado com 5 tipos)
- Atualizar tipos em `src/types/creatives.ts`
- Atualizar `useVideoCreatives.ts`
- Reescrever memory `features/ai/image-generation-native-priority` com nova hierarquia
- Criar memory `features/ai/video-generation-standard` com pipeline documentado
- Atualizar `docs/especificacoes/marketing/criativos.md`

---

## Detalhes técnicos

### Arquivos a criar
| Arquivo | Descrição |
|---------|-----------|
| `_shared/fal-client.ts` | Cliente centralizado fal.ai (imagens + vídeos) |
| `video-forms/VideoGeneratorForm.tsx` | Formulário unificado de vídeo |

### Arquivos a remover
| Arquivo | Motivo |
|---------|--------|
| `video-forms/UGCRealForm.tsx` | Substituído |
| `video-forms/UGCAIForm.tsx` | Substituído |
| `video-forms/ProductVideoForm.tsx` | Substituído |
| `video-forms/AvatarMascotForm.tsx` | Substituído |
| `creative-generate/index.ts` | Pipeline legado |
| `creative-process/index.ts` | Pipeline legado |

### Arquivos a reescrever
| Arquivo | Alteração |
|---------|-----------|
| `creative-image-generate/index.ts` | fal.ai como step 1, stack atual como fallback |
| `media-process-generation-queue/index.ts` | Mesma hierarquia |
| `ai-landing-page-enhance-images/index.ts` | Mesma hierarquia |
| `_shared/visual-engine.ts` | Mesma hierarquia |
| `ai-block-fill-visual/index.ts` | Mesma hierarquia |
| `creative-video-generate/index.ts` | Pipeline fal.ai (Kling/Veo/Wan) |
| `media-generate-video/index.ts` | Pipeline fal.ai para calendário |
| `UnifiedVideoTab.tsx` | Formulário único |
| `src/types/creatives.ts` | Limpar tipos antigos, adicionar novos |
| `src/hooks/useVideoCreatives.ts` | Adaptar para novo pipeline |
| `src/lib/driveService.ts` | Rotas de vídeo |

### Nova hierarquia (substitui a v6.0 atual)

```text
IMAGENS (v7.0):
  1. fal.ai FLUX 2 Pro        ← PRINCIPAL (melhor custo-benefício)
  2. fal.ai FLUX 2 Turbo      ← PRINCIPAL fallback rápido
  3. Gemini Nativa             ← FALLBACK SEGURO (stack atual)
  4. OpenAI Nativa             ← FALLBACK SEGURO
  5. Lovable Gateway           ← ÚLTIMO RECURSO

VÍDEOS (v1.0):
  1. fal.ai Kling v3 Pro I2V   ← PRINCIPAL (padrão)
  2. fal.ai Veo 3.1            ← PRINCIPAL (com áudio nativo)
  3. fal.ai Wan 2.6 I2V        ← ECONÔMICO
  4. Imagem estática (stack atual) ← FALLBACK SEGURO
```

### Dependências
- `FAL_API_KEY` — já na `platform_credentials`
- `ELEVENLABS_API_KEY` — já nos secrets (connector)
- `GEMINI_API_KEY` — já na `platform_credentials`
- `OPENAI_API_KEY` — já nos secrets
- `voice_presets` — tabela e seletor já funcionais

