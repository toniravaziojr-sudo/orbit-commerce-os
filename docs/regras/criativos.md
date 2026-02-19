# Regras: Gestão de Criativos

> Módulo para geração de vídeos e imagens com IA

## Arquivos Relacionados

- `src/pages/Creatives.tsx` — Página principal (3 abas: Vídeos, Imagens, Galeria)
- `src/components/creatives/UnifiedVideoTab.tsx` — Aba unificada de vídeos
- `src/components/creatives/video-forms/*` — Formulários por tipo de vídeo
- `src/components/creatives/VoiceSelector.tsx` — Seletor de voz (preset ou custom)
- `src/components/creatives/VideoJobsList.tsx` — Lista de jobs de vídeo v2.0
- `src/hooks/useCreatives.ts` — Hook de dados (imagens)
- `src/hooks/useVideoCreatives.ts` — Hook de dados (vídeos v2.0)
- `src/hooks/useVoicePresets.ts` — Hook de presets de voz
- `src/types/creatives.ts` — Tipos TypeScript
- `supabase/functions/creative-video-generate/index.ts` — Edge function de vídeo v2.0
- `supabase/functions/creative-image-generate/index.ts` — Edge function de imagem

---

## Stack de Ferramentas v4.0

| Ferramenta | Função | Uso Principal |
|------------|--------|---------------|
| **Gemini Pro** (`gemini-3-pro-image-preview`) | Geração de imagem (primary) | Todos os estilos |
| **Gemini Flash** (`gemini-2.5-flash-image`) | Geração de imagem (fallback) | Retry automático |
| **ElevenLabs** | Síntese de voz / Clonagem | TTS PT-BR para todos os tipos |
| **Sync Labs** | Sincronização labial | Lipsync em vídeos com pessoas |
| **Akool** | Troca de rostos (Face Swap) | UGC Transformado |
| **HeyGen** | Avatares falantes | Mascotes e apresentadores IA |

---

## Estrutura de Abas

| Aba | Descrição |
|-----|-----------|
| **Vídeos** | Aba unificada com dropdown de tipos |
| **Imagens** | Geração de imagens (OpenAI/Gemini) |
| **Galeria** | Visualização de todos os criativos |

---

## Tipos de Vídeo (Dropdown)

| Tipo | ID | Pipeline | Descrição |
|------|-----|----------|-----------|
| UGC 100% IA | `ugc_ai` | Runway → ElevenLabs → Sync Labs | Pessoa IA segurando/usando produto |
| UGC Transformado | `ugc_real` | Akool → ElevenLabs → Sync Labs | Transformar vídeo existente (rosto/voz/fundo) |
| Vídeo de Produto | `product_video` | Runway + ElevenLabs | Vídeos promocionais sem pessoas |
| Avatar / Mascote | `avatar_mascot` | HeyGen | Avatar/mascote animado falando |

---

## Formulários de Vídeo

| Componente | Tipo | Campos Principais |
|------------|------|-------------------|
| `UGCAIForm` | `ugc_ai` | Produto, Prompt visual, Script, Voz |
| `UGCRealForm` | `ugc_real` | Vídeo original, Opções de transformação |
| `ProductVideoForm` | `product_video` | Produto, Estilo visual, Narração |
| `AvatarMascotForm` | `avatar_mascot` | Avatar, Script, Personalidade |

---

## Pipeline de Vídeo v2.0

### Arquitetura de 6 Etapas

| Etapa | Nome | Descrição |
|-------|------|-----------|
| 1 | `preprocess` | Gera cutout/mask do produto |
| 2 | `rewrite` | Otimiza prompt com LLM → shot_plan estruturado |
| 3 | `generate_candidates` | Produz N variações via modelo de vídeo |
| 4 | `qa_select` | Avalia qualidade (Similarity 40% + OCR 30% + Quality 30%) |
| 5 | `retry` | Se falhar, retry com fidelidade rígida |
| 6 | `fallback` | Se ainda falhar, composição do cutout real sobre cenário |

### Tabelas do Banco

| Tabela | Descrição |
|--------|-----------|
| `creative_video_jobs` | Jobs de geração de vídeo |
| `creative_video_candidates` | Variações geradas e seus scores |
| `creative_video_presets` | Presets compostos (cena, luz, câmera, narrativa) |
| `creative_preset_components` | Componentes modulares reutilizáveis |
| `product_category_profiles` | Perfis de categoria com pesos de QA |

### Scores de QA

| Score | Peso | Descrição |
|-------|------|-----------|
| `qa_similarity_score` | 40% | Similaridade visual com produto original |
| `qa_label_score` | 30% | OCR do rótulo/marca |
| `qa_temporal_score` | 15% | Estabilidade temporal (sem glitches) |
| `qa_quality_score` | 15% | Qualidade geral (nitidez, composição) |

Threshold de aprovação: **70%** (configurável por categoria)

---

## Pipeline de Áudio PT-BR (ElevenLabs)

### Fluxo por Tipo de Vídeo

#### A) Vídeos de Produto (sem pessoas)

1. Gerar vídeo com Runway ML
2. Gerar áudio PT-BR via ElevenLabs (script + voice preset)
3. Mux áudio + vídeo → MP4 final

#### B) Talking Head / UGC com Rosto

1. Gerar/transformar vídeo (Runway/Akool)
2. Gerar áudio PT-BR via ElevenLabs
3. Aplicar Sync Labs (sincroniza lábios)
4. Resultado final com áudio sincronizado

### Requisitos para TTS

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `tts_script` | ✅ | Texto em português para narração |
| `voice_preset_id` | ✅* | ID do preset de voz (obrigatório se não usar custom) |
| `custom_voice_url` | ✅* | URL de áudio customizado (obrigatório se não usar preset) |

\* Pelo menos um dos dois deve ser fornecido.

---

## Componente VoiceSelector

### Arquivo
`src/components/creatives/VoiceSelector.tsx`

### Modos de Seleção

| Modo | Tab | Descrição |
|------|-----|-----------|
| `preset` | Vozes Prontas | Seleciona preset pré-configurado do banco |
| `custom` | Minha Voz | Upload de amostra de áudio (10-30s) |

### Props

```typescript
interface VoiceSelectorProps {
  value: string | null;              // voice_preset_id selecionado
  onValueChange: (id: string | null) => void;
  customAudioUrl: string | null;     // URL do áudio customizado
  onCustomAudioChange: (url: string | null) => void;
  disabled?: boolean;
}
```

### Comportamento

1. **Vozes Prontas**: Lista presets com `ref_audio_url` válido
2. **Minha Voz**: Upload via `useSystemUpload` → salva em Drive
3. **Preview**: Player de áudio inline para ambos os modos
4. **Exclusividade**: Selecionar preset limpa custom e vice-versa

---

## Voice Presets

Presets são armazenados em `voice_presets` e **DEVEM** ter:

- `ref_audio_url` — URL do áudio de referência (10-30s)
- `ref_text` — Transcrição do áudio de referência
- `is_active: true`

**Sem `ref_audio_url`**, o ElevenLabs não funciona!

---

## Opções de Áudio na UI

### Enum `AudioMode`

```typescript
type AudioMode = 'none' | 'tts_ptbr';
```

| Valor | Label | Comportamento |
|-------|-------|---------------|
| `none` | Sem áudio | Vídeo mudo |
| `tts_ptbr` | Português (TTS) | ElevenLabs + Sync Labs |

### UI Condicional

Quando `audioMode === 'tts_ptbr'`:
- Exibir campo **Script** (textarea obrigatória)
- Exibir **VoiceSelector** (presets ou custom)

---

## Cálculo de Custo

### Custos por Step (em USD)

| Step | Modelo | Custo Base |
|------|--------|------------|
| Runway ML | Gen-3 Alpha | ~$0.50/5s |
| ElevenLabs | TTS | ~$0.30/1000 chars |
| Sync Labs | Lipsync | ~$0.10/request |
| Akool | Face Swap | ~$0.20/request |
| HeyGen | Avatar | Variável por plano |

---

## Settings no creative_jobs

### Campos Relevantes para Áudio

```typescript
interface CreativeSettings {
  // ... outros campos
  
  // Áudio
  audio_mode: 'none' | 'tts_ptbr';
  tts_script?: string;        // Texto para narração
  voice_preset_id?: string;   // UUID do preset
  
  // Populados pelo backend
  tts_audio_url?: string;     // URL do áudio gerado
}
```

---

## Regras de Prompt

### Personagem e Estilo via Prompt

**NÃO usar campos separados** para personagem/estilo. Tudo deve ser descrito no prompt:

✅ Correto:
```
"Uma mulher jovem, cabelos castanhos, estilo profissional, 
apresentando o produto em um escritório moderno..."
```

❌ Errado:
- Campos separados para `personGender`, `personAge`, `scenarioPreset`
- Conflita com descrições do prompt

---

## Regra de Mãos / Kit (v4.0)

### Detecção Automática de Kit

O sistema detecta automaticamente se o produto é um kit/pack pelo nome:

| Padrão no Nome | Tipo Detectado | Exemplo |
|----------------|---------------|---------|
| `Kit` | kit | "Kit Calvície Zero" |
| `2x`, `3x`, `(2x)` | pack | "Shampoo (2x)" |
| `2 Un`, `3 unidades`, `2 unidade` | pack | "Shampoo 2 Un" |
| `combo`, `conjunto`, `pack` | combo | "Combo Completo" |
| Nenhum dos acima | single | "Shampoo Calvície Zero" |

### Regras de Posicionamento

| Tipo | Nas Mãos | Ambiente |
|------|----------|----------|
| **Produto único** | 1 ou 2 mãos | N/A |
| **Pack 2 itens** | Máx 1 em cada mão | N/A |
| **Kit 3+ itens (embalagem única)** | Pode segurar a embalagem | N/A |
| **Kit 3+ itens (avulsos)** | Máx 1 em cada mão | Restante em mesa/bancada |

### Proibições

- Empilhar vários produtos nas mãos
- Segurar kit avulso de forma desproporcional
- Mãos com aparência não natural ou forçada

---

## Pipeline Resiliente v4.0

### Retry Automático (3 Tentativas)

| Tentativa | Modelo | Prompt |
|-----------|--------|--------|
| 1 | `gemini-3-pro-image-preview` | Prompt completo |
| 2 | `gemini-2.5-flash-image` | Mesmo prompt (modelo diferente) |
| 3 | `gemini-3-pro-image-preview` | Prompt simplificado (fundo branco) |

### Fallback Final: Imagem do Catálogo

Se TODAS as 3 tentativas falharem:
- O `ads_creative_asset` é marcado como `ready` com `image_status: 'fallback_catalog'`
- A imagem original do produto (catálogo) é usada como criativo
- O callback `creative_ready` é disparado normalmente
- **O pipeline de campanhas NUNCA trava**

---

## Proibições

| Proibido | Motivo |
|----------|--------|
| Campos de personagem na UI | Conflita com prompt |
| Usar TTS sem `ref_audio_url` | ElevenLabs requer referência |
| Muxar áudio via Edge Function | Deno não tem ffmpeg |
| Pipeline sem fallback | Trava o fluxo de campanhas |
| Segurar kit 3+ avulso nas mãos | Desproporcional/irreal |

---

## Checklist de Implementação

- [x] Aba unificada de vídeos com dropdown
- [x] Formulários específicos por tipo
- [x] Pipeline resiliente (retry 3x + fallback catálogo)
- [x] Detecção automática de kit/pack
- [x] Regras de mãos por tipo de produto
- [ ] Integração Runway ML (Gen-3 Alpha)
- [ ] Integração ElevenLabs (conector disponível)
- [ ] Integração Sync Labs (lipsync)
- [ ] Integração Akool (face swap)
- [ ] Integração HeyGen (avatares)
- [ ] Campo `audio_mode` no formulário
- [ ] UI condicional para script + voice preset
- [ ] Edge functions para cada pipeline
- [ ] Cálculo de custo dinâmico
