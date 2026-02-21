# Memory: features/ai/image-generation-native-priority-v5
Updated: now

O pipeline de geração de imagens (v5.1.0) em todos os agentes (Calendário, Criativos e Tráfego) prioriza obrigatoriamente integrações nativas diretas via API da OpenAI e Google Gemini (Google AI Studio), utilizando o Lovable Gateway estritamente como fallback.

### Modelos e Endpoints OpenAI (INVIOLÁVEL)
- **Chat Completions API** (`/v1/chat/completions`): Usa `gpt-image-1` com `modalities: ['image', 'text']`. Suporta edição (com imagem de referência via `image_url` no content) e geração pura.
- **PROIBIDO:** Usar a Images API legacy (`/v1/images/edits`, `/v1/images/generations`) que só aceita `dall-e-2`/`dall-e-3` com qualidade inferior.

### Extração de Imagem do Response
O `gpt-image-1` retorna imagens em formatos variados:
1. `choices[0].message.output_images[0].url` (formato data:image/png;base64,...)
2. `choices[0].message.content[]` com parts tipo `image_url`
O código implementa fallback entre ambos os formatos.

### Pipeline de Resiliência
1. OpenAI nativa (gpt-image-1 via Chat Completions) → 2. Lovable Gateway Gemini Pro → 3. Lovable Gateway Gemini Flash → 4. Fallback para imagem do catálogo
- 3 retentativas com timeout de 15s
- Markup de créditos padrão (1.5x) aplicado
- Regra suprema de fidelidade 'Label Lock' mantida

### Arquivos Relacionados
- `supabase/functions/creative-image-generate/index.ts` — Pipeline de criativos de anúncios (v5.1.0)
- `supabase/functions/media-process-generation-queue/index.ts` — Pipeline de mídia do calendário

### Checklist Anti-Regressão
- [ ] OpenAI usa Chat Completions API (`/v1/chat/completions`) com `gpt-image-1`
- [ ] Images API legacy (`/v1/images/*`) NUNCA é usada
- [ ] Referência de imagem enviada como `image_url` no content (não FormData)
- [ ] Extração de base64 cobre `output_images` e `content` parts
- [ ] Lovable Gateway usa `google/gemini-3-pro-image-preview` e `google/gemini-2.5-flash-image`
- [ ] Fallback para catálogo funciona quando todos os provedores falham
