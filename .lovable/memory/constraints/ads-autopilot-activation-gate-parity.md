---
name: Ads Autopilot Activation Gate Parity
description: Todo novo caminho de ativação do Ads Autopilot (canal, conta, campanha, feature) deve atualizar count_active_tenants_for_module('ai_traffic_manager') e trigger de mark_module_active_by_event
type: constraint
---

## Regra
Qualquer novo caminho de ativação do Ads Autopilot (por canal em `ads_autopilot_configs`, por conta em `ads_autopilot_account_configs`, ou granularidade futura como por campanha/feature) DEVE, na mesma entrega:

1. Atualizar o branch `'ai_traffic_manager'` em `public.count_active_tenants_for_module(text)` para considerar o novo caminho via UNION com os critérios já existentes.
2. Instalar trigger AFTER INSERT/UPDATE na tabela de origem chamando `public.mark_module_active_by_event('ai_traffic_manager')` quando os critérios de ativação forem satisfeitos.
3. Validar com `SELECT public.refresh_system_resource_usage()` que `system_resource_usage` para `ai_traffic_manager` reflete a contagem real.

**Critérios de exclusão obrigatórios para qualquer caminho:** ignorar registros com `is_ai_enabled=false`, `kill_switch=true` ou `autonomy_mode='off'`.

## Por quê
Em 2026-06-03 o piloto observacional C.3.2 foi ativado para o tenant Respeite o Homem pelo caminho granular (`ads_autopilot_account_configs`), mas o gate só reconhecia o caminho legado por canal. Os crons (`ads-autopilot-analyze`, `ads-autopilot-guardian-*`, `ads-autopilot-scheduled-runner-5m`, `ads-creative-generate`, `ads-experiments-run`, `ads-weekly-insights`) pularam por `no_active_tenants` durante 7 dias, sem sessões/propostas/observações. Corrigido em 2026-06-07.

## Como aplicar
Code review bloqueia PR que adicione tabela/coluna de ativação do Ads Autopilot sem (a) atualizar o branch `ai_traffic_manager` na função do gate, (b) instalar trigger de ativação imediata e (c) declarar evidência de refresh validado.
