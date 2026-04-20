---
name: WhatsApp WABA swap requires operational re-validation
description: Toda troca de WABA ou phone_number_id em whatsapp_configs abre janela obrigatória de observação de 24h. Status público NUNCA é "saudável" só com vínculo técnico — precisa de evidência operacional (inbound real). Doc formal em docs/especificacoes/whatsapp/fluxo-recepcao-meta.md (v1.1).
type: constraint
---
Quando `whatsapp_configs.phone_number_id` ou `waba_id` mudam (troca de WABA, novo número, reconexão com identificadores diferentes):

1. **Trigger SQL `whatsapp_configs_track_migration`** captura `previous_phone_number_id` / `previous_waba_id`, reseta `linked_at`, abre `migration_observation_until = now() + 24h` e zera `last_inbound_at`.
2. **`whatsapp-health-summary`** retorna `link_status` (vínculo técnico) e `operational_status` (operação real) separados — nunca um único "conectado".
3. **`useWhatsAppStatus` / `useIntegrationStatus` / `WhatsAppHealthCard`** consomem ambas as camadas: o canal só aparece como "Recebendo normalmente" quando `link_status=connected` E `operational_status=healthy`.
4. **`meta-whatsapp-webhook`** grava `last_inbound_at = now()` e zera `migration_observation_until` na primeira inbound real do novo número — só então o canal pode voltar a "saudável".

**Regra anti-regressão (proibido):**
- Marcar troca de WABA como sucesso completo só porque os identificadores foram salvos.
- Reportar canal como "conectado" / "saudável" / "ok" baseando-se apenas em `connection_status='connected'`. Sempre validar operação real.
- Voltar a hipóteses externas (display name, billing, aprovação Meta) antes de confirmar que `link_status` está OK e `operational_status` está em `observation` ou `degraded` por causa real.

**Onde a regra vive (fonte primária):**
- `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` v1.1 — seções "Status em camadas" e "Troca de WABA / Phone Number ID".
- `docs/tecnico/base-de-conhecimento-tecnico.md` — entrada anti-regressão "Troca de WABA tratada como saúde operacional".

Esta memória é apenas reforço. Se conflitar com os docs, vencem os docs.
