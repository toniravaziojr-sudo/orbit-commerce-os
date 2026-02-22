# Memory: features/marketing/ads-autopilot-implement-campaigns-strict-fidelity-v1-44
Updated: now

## Fix: IA criava campanhas/adsets extras fora do plano (v1.44.0)

### Problema
Na Fase 2 (`implement_campaigns`), a IA adicionava campanhas e adsets que NÃO estavam no plano aprovado. Exemplo: plano com 4 ações gerou 7 campanhas + 1 adset extra (8 pending_approval).

### Causa Raiz
O prompt de `implement_campaigns` não exigia fidelidade estrita ao plano. A IA tinha liberdade para "interpretar" e "melhorar" o plano, adicionando estruturas extras como adsets LAL adicionais ou campanhas TOF duplicadas.

### Correção (v1.44.0)
Bloco `🔒 FIDELIDADE ESTRITA AO PLANO (REGRA INVIOLÁVEL)` adicionado ao prompt com regras:
- Criar EXATAMENTE as campanhas listadas em `planned_actions`
- NÃO inventar campanhas/adsets extras
- Número total de `create_campaign` + `create_adset` DEVE corresponder ao plano
- Se o plano precisa de ajustes, executar fielmente e sugerir melhorias via insights

### Checklist Anti-Regressão
- [ ] Prompt de `implement_campaigns` contém bloco de fidelidade estrita
- [ ] Número de campanhas criadas = número de ações no plano
- [ ] Adsets criados correspondem EXATAMENTE aos listados em `adsets[]` do plano
- [ ] IA não adiciona estruturas extras "por conta própria"
