---
name: Gestor de Tráfego — sem "IA global" e Aviso ≠ Proposta (Onda 3)
description: Anti-regressão para o Gestor de Tráfego pós-Onda 3 (2026-06-17). Proíbe reintroduzir configuração global de IA e exige separação rígida entre Aviso (diagnóstico) e Proposta (ação).
type: constraint
---

# Gestor de Tráfego — Onda 3 (2026-06-17)

## Regras invioláveis

1. **Não existe "IA global" no Gestor de Tráfego.** Toda configuração que afeta execução (orçamento, ROI/ROAS alvo, instruções, prompt estratégico, modo, funil, autonomia, kill switch, UTM) vive **por conta de anúncios** em `ads_autopilot_account_configs`. É proibido criar nova UI ou nova rotina que leia `ads_autopilot_configs` com `channel='global'` como fallback de execução. O registro `global` continua existindo apenas para histórico — não pode voltar a alimentar fluxo vivo.

2. **Aviso ≠ Proposta.** Tabela `ads_ai_warnings` é exclusivamente para sinais diagnósticos que o usuário precisa **ver**, não para ações. Aviso nunca executa nada na plataforma de anúncios e nunca aparece em "Aguardando Ação". Proposta vive em `ads_autopilot_actions` (status pendente) e sempre exige aprovação humana antes de publicar.

3. **Regra de saída única do ciclo da IA por conta** (`ads-autopilot-analyze`):
   - Sinal com ação concreta dentro das regras da conta → grava em `ads_autopilot_actions` (proposta).
   - Sinal diagnóstico relevante sem ação concreta → grava em `ads_ai_warnings`.
   - Sinal irrelevante / contexto puro → memória interna apenas.

4. **Tabela `ads_autopilot_insights` está aposentada como destino vivo.** Não pode receber novos inserts a partir de `ads-autopilot-analyze`, `ads-autopilot-execute-approved`, `ads-autopilot-publish-proposal` ou cron. Histórico anterior é preservado, mas leitura na UI principal foi removida (aba Insights não existe mais).

5. **Rotina semanal `ads-weekly-insights` (pg_cron jobid 74) está desativada e não pode ser reagendada.** Botão "Gerar Insights Agora" também não pode voltar.

## Ordem fixa das abas principais em `/ads`

1. Gerenciador
2. Chat IA (antes "Chat IA Global")
3. Aprendizado da IA
4. Desempenho (antes "Visão Geral")
5. Avisos

Sub-aba "Chat IA" dentro de cada conta foi consolidada no Chat IA principal — não pode voltar.

## Quando virar Aviso em Proposta

Quando a IA evolui um aviso para ação concreta, ela cria a proposta em `ads_autopilot_actions` e marca o aviso original em `ads_ai_warnings` com `status='converted'` e `converted_to_action_id` apontando para a proposta. A UI mostra badge "Virou proposta" no aviso.

## Por que essa regra existe

A duplicidade "config global + config por conta" causava confusão de hierarquia, prompts duplicados e propostas conflitantes. A separação "Aviso vs Proposta" foi instalada porque a aba Insights antiga misturava diagnóstico passivo com recomendação acionável, gerando ruído e propostas que ninguém aprovava. O ciclo da IA por conta passa a ser a única fonte de propostas e avisos.
