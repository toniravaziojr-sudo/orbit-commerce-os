# Memory: features/ai/image-generation-native-priority-v5
Updated: now

O pipeline de geração de imagens (v5.1.0) em todos os agentes (Calendário, Criativos e Tráfego) prioriza obrigatoriamente integrações nativas diretas via API da OpenAI e Google Gemini (Google AI Studio), utilizando o Lovable Gateway estritamente como fallback.

### Modelos OpenAI por Endpoint (INVIOLÁVEL)
- **Edits** (`/v1/images/edits` — com imagem de referência): Usa obrigatoriamente `dall-e-2`. Este endpoint **não suporta** `gpt-image-1` nem `dall-e-3`.
- **Generations** (`/v1/images/generations` — sem referência): Usa `dall-e-3` para máxima qualidade.
- **PROIBIDO:** Usar `gpt-image-1` em qualquer endpoint da Images API (`/v1/images/*`). Este modelo só funciona via Chat Completions API.

### Pipeline de Resiliência
1. OpenAI nativa (dall-e-2/dall-e-3) → 2. Lovable Gateway Gemini Pro → 3. Lovable Gateway Gemini Flash → 4. Fallback para imagem do catálogo
- 3 retentativas com timeout de 15s
- Markup de créditos padrão (1.5x) aplicado
- Regra suprema de fidelidade 'Label Lock' mantida

### Arquivos Relacionados
- `supabase/functions/creative-image-generate/index.ts` — Pipeline de criativos de anúncios
- `supabase/functions/media-process-generation-queue/index.ts` — Pipeline de mídia do calendário

### Checklist Anti-Regressão
- [ ] Endpoint `/v1/images/edits` usa `dall-e-2` (nunca gpt-image-1)
- [ ] Endpoint `/v1/images/generations` usa `dall-e-3`
- [ ] Lovable Gateway usa `google/gemini-3-pro-image-preview` e `google/gemini-2.5-flash-image`
- [ ] Fallback para catálogo funciona quando todos os provedores falham
