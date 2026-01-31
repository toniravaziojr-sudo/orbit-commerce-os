# Regras: Gestão de Criativos

> Módulo para geração de vídeos e imagens com IA

## Arquivos Relacionados

- `src/pages/Creatives.tsx` — Página principal
- `src/components/creatives/*` — Componentes de cada aba
- `src/components/creatives/VoiceSelector.tsx` — Seletor de voz (preset ou custom)
- `src/hooks/useCreatives.ts` — Hook de dados
- `src/hooks/useVoicePresets.ts` — Hook de presets de voz
- `src/types/creatives.ts` — Tipos TypeScript
- `supabase/functions/creative-process/index.ts` — Edge function de processamento

## Estrutura de Abas

| Aba | Tipo | Descrição |
|-----|------|-----------|
| UGC Real | `ugc_client_video` | Vídeo gravado pelo cliente com transformações |
| UGC 100% IA | `ugc_ai_video` | Avatar IA apresentando produto |
| Vídeos Produto | `product_video` | Vídeos SEM pessoas (rotação, efeitos) |
| Imagens | `product_image` | Pessoas + cenário + produto |
| Mascote | `avatar_mascot` | Mascote animado falando |
| Galeria | `gallery` | Visualização de todos os criativos |

---

## Limitações Técnicas Fundamentais

### 1. Áudio Nativo do Kling I2V

**CRÍTICO**: O modelo Kling I2V v2.6 Pro (`fal-ai/kling-video/v2.6/pro/image-to-video`) suporta áudio nativo **apenas em Inglês e Chinês**.

- `generate_audio: true` → Áudio em EN/ZH apenas
- `generate_audio: false` → Vídeo mudo
- **NÃO EXISTE** forma de forçar PT-BR via prompt no áudio nativo

### 2. Solução para Português: Pipeline TTS

Para narrações em Português, usar pipeline separado:

```
F5-TTS (gera áudio PT-BR) → Sync LipSync (mux/sincroniza)
```

---

## Pipeline de Áudio PT-BR (TTS)

### Modelos Utilizados

| Modelo | Endpoint | Função |
|--------|----------|--------|
| F5-TTS | `fal-ai/f5-tts` | Gera áudio PT-BR a partir de texto |
| Sync LipSync | `fal-ai/sync-lipsync/v2/pro` | Sincroniza áudio com vídeo |

### Fluxo por Tipo de Vídeo

#### A) Vídeos de Produto (sem pessoas)

1. Gerar vídeo com Kling I2V (`generate_audio: false`)
2. Gerar áudio PT-BR via F5-TTS (script + voice preset)
3. Mux áudio + vídeo via Sync LipSync → MP4 final

#### B) Talking Head / UGC com Rosto

1. Gerar/transformar vídeo (PixVerse/Kling)
2. Gerar áudio PT-BR via F5-TTS
3. Aplicar Sync LipSync (sincroniza lábios)
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

**Sem `ref_audio_url`**, o F5-TTS não funciona!

---

## Opções de Áudio na UI

### Enum `AudioMode`

```typescript
type AudioMode = 'none' | 'native' | 'tts_ptbr';
```

| Valor | Label | Comportamento |
|-------|-------|---------------|
| `none` | Sem áudio | `generate_audio: false`, sem TTS |
| `native` | Nativo (EN/ZH) | `generate_audio: true` |
| `tts_ptbr` | Português (TTS) | F5-TTS + Sync LipSync |

### UI Condicional

Quando `audioMode === 'tts_ptbr'`:
- Exibir campo **Script** (textarea obrigatória)
- Exibir select **Voz** (voice presets ativos com `ref_audio_url`)

---

## Cálculo de Custo

### Custos por Step (em USD)

| Step | Modelo | Custo Base |
|------|--------|------------|
| Kling I2V | `fal-ai/kling-video/v2.6/pro` | $0.32/5s |
| F5-TTS | `fal-ai/f5-tts` | $0.01/request |
| Sync LipSync | `fal-ai/sync-lipsync/v2/pro` | $0.05/request |

### Fórmula Total

```
custo_total = custo_video + (tts_ptbr ? custo_tts + custo_sync : 0)
```

---

## Settings no creative_jobs

### Campos Relevantes para Áudio

```typescript
interface CreativeSettings {
  // ... outros campos
  
  // Áudio
  audio_mode: 'none' | 'native' | 'tts_ptbr';
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

### Prompt NÃO Controla Idioma do Áudio

O idioma do áudio depende **exclusivamente** do `audio_mode`:
- `native` → EN/ZH (independente do prompt)
- `tts_ptbr` → PT-BR via TTS (independente do prompt)

---

## Proibições

| Proibido | Motivo |
|----------|--------|
| Prometer PT-BR no áudio nativo | Kling I2V não suporta |
| Campos de personagem na UI | Conflita com prompt |
| Usar TTS sem `ref_audio_url` | F5-TTS requer áudio de referência |
| Muxar áudio via Edge Function | Deno não tem ffmpeg |

---

## Edge Function: creative-process

### Pipeline Steps

```typescript
const steps = [
  { name: 'tts', model: 'fal-ai/f5-tts' },           // Se tts_ptbr
  { name: 'video', model: 'fal-ai/kling-video/...' },
  { name: 'sync', model: 'fal-ai/sync-lipsync/...' }, // Se tts_ptbr
];
```

### Requisitos para TTS

Antes de chamar F5-TTS, buscar o preset:

```typescript
const { data: preset } = await supabase
  .from('voice_presets')
  .select('ref_audio_url, ref_text')
  .eq('id', settings.voice_preset_id)
  .single();

if (!preset?.ref_audio_url) {
  throw new Error('Voice preset sem ref_audio_url');
}
```

---

## Checklist de Implementação

- [ ] Campo `audio_mode` no formulário
- [ ] UI condicional para script + voice preset
- [ ] Hook `useVoicePresets` filtrando `ref_audio_url`
- [ ] Edge function com step TTS antes do vídeo
- [ ] Edge function com step Sync após vídeo
- [ ] Cálculo de custo incluindo TTS + Sync
- [ ] Tratamento de erro se preset sem `ref_audio_url`
