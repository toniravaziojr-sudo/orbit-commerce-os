# Memory: features/ai/image-generation-native-priority-v5
Updated: now

O pipeline de geração de imagens (v5.2.0) em todos os agentes (Calendário, Criativos e Tráfego) prioriza obrigatoriamente integrações nativas diretas via API da OpenAI e Google Gemini (Google AI Studio), utilizando o Lovable Gateway estritamente como fallback.

### Modelos e Endpoints OpenAI (INVIOLÁVEL)
- **Chat Completions API** (`/v1/chat/completions`): Usa `gpt-image-1` com `modalities: ['image', 'text']`. Suporta edição (com imagem de referência via `image_url` no content) e geração pura.
- **PROIBIDO:** Usar a Images API legacy (`/v1/images/edits`, `/v1/images/generations`) que só aceita `dall-e-2`/`dall-e-3` com qualidade inferior.

### Extração de Imagem do Response
O `gpt-image-1` retorna imagens em formatos variados:
1. `choices[0].message.output_images[0].url` (formato data:image/png;base64,...)
2. `choices[0].message.content[]` com parts tipo `image_url`
O código implementa fallback entre ambos os formatos.

### Pipeline de Resiliência (v5.2.0)
1. OpenAI nativa (gpt-image-1 via Chat Completions) → 2. Lovable Gateway Gemini Pro → 3. Lovable Gateway Gemini Flash → **4. Busca no Drive ("Gestor de Tráfego IA") por `product_id`** → 5. Fallback para imagem do catálogo
- 3 retentativas com timeout de 15s
- Markup de créditos padrão (1.5x) aplicado
- Regra suprema de fidelidade 'Label Lock' mantida

### Fallback Drive (v5.2.0 — NOVO)
Quando todos os provedores de IA falham, antes de usar imagem do catálogo:
1. Busca a pasta "Gestor de Tráfego IA" na tabela `files` (`is_folder: true`)
2. Filtra arquivos com `metadata->product_id` igual ao produto sendo processado
3. Ordena por: `is_winner: true` primeiro, depois `scores.overall` decrescente
4. Usa a URL pública do melhor criativo encontrado
5. Marca `meta.fallback_source = 'drive'` e `meta.image_status = 'fallback_drive'` no `ads_creative_assets`
6. Se nenhum criativo for encontrado no Drive, cai para imagem do catálogo (`fallback_catalog`)

### Arquivos Relacionados
- `supabase/functions/creative-image-generate/index.ts` — Pipeline de criativos de anúncios (v5.2.0)
- `supabase/functions/media-process-generation-queue/index.ts` — Pipeline de mídia do calendário

### Checklist Anti-Regressão
- [ ] OpenAI usa Chat Completions API (`/v1/chat/completions`) com `gpt-image-1`
- [ ] Images API legacy (`/v1/images/*`) NUNCA é usada
- [ ] Referência de imagem enviada como `image_url` no content (não FormData)
- [ ] Extração de base64 cobre `output_images` e `content` parts
- [ ] Lovable Gateway usa `google/gemini-3-pro-image-preview` e `google/gemini-2.5-flash-image`
- [ ] Fallback Drive busca por `product_id` na pasta "Gestor de Tráfego IA" antes do catálogo
- [ ] Fallback para catálogo funciona quando Drive e provedores falham
