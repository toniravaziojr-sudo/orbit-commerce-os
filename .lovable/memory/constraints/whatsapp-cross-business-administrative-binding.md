---
name: WhatsApp Meta — vínculo administrativo cross-business
description: Subscribe técnico OK não comprova roteamento real de inbound; recepção real exige vínculo cross-business no painel Meta, manual e obrigatório. Modelo oficial é híbrido.
type: constraint
---

**Regra estrutural (não voltar a investigar do zero):**

Para inbound real do WhatsApp Meta chegar a um tenant, dois mundos precisam estar OK:

1. **Técnico (automatizável):** token + subscribe da WABA + webhook respondendo + número registrado.
2. **Administrativo cross-business (manual obrigatório):** o Business que detém a WABA do tenant precisa adicionar o nosso Business como parceiro com permissão de mensagens. **A Meta não expõe API pública para isso** — qualquer plataforma poderia se autoadicionar a qualquer WABA. É regra de segurança da Meta, não nossa.

**Consequências para o produto:**

- Teste técnico do webhook (challenge GET, POST de teste do painel) **não comprova operação real**.
- Validação canônica oficial = mensagem real do tenant + auditoria bruta (`whatsapp_webhook_raw_audit`).
- Modelo oficial é **híbrido**: caminho feliz (WABA criada no Embedded Signup) é 100% automático; caminho residual (WABA pré-existente/migrada) exige o passo manual.
- UI nunca mostra verde sem `last_inbound_validated_at` recente.
- Detector usa regra refinada: nunca-validado → "Recepção real pendente" com hipótese cross-business; já-validado em silêncio < 24h → operacional; 24-72h → "Sem evidência recente"; > 72h só vai para "Degradado" com pelo menos 1 dos 5 sinais objetivos (erro Meta crítico, diagnose != healthy 24h, mudança de identidade, validação expirada).
- Linguagem obrigatória: "hipótese principal", "possível", "recomendamos validar". Nunca afirmar causa.

**Antes de propor "remendo" ou reabrir investigação:** ler `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` (Layer 3) e o runbook de troubleshooting (Layer 4).
