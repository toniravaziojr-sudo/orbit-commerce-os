## Onda 3 — Concluída (2026-06-17)

### O que foi entregue

1. **Aba Insights removida** da tela do Gestor de Tráfego.
2. **Ordem final das abas principais**: Gerenciador · Chat IA · Aprendizado da IA · Desempenho · Avisos.
3. **Rotina semanal de Insights desligada** (cron `ads-weekly-insights`, jobid 74 — `unschedule`).
4. **Ciclo da IA por conta agora popula a aba Avisos**: o destino de "sinal diagnóstico" em `ads-autopilot-analyze` foi redirecionado da tabela antiga `ads_autopilot_insights` para `ads_ai_warnings`, com severidade (informativo / atenção / urgente) e tendência (up/down/flat) derivadas dos `risk_alerts` e `kpi_analysis.overall_trend`.
5. **Widget de alertas do Dashboard** trocou a fonte de Insights para Avisos.
6. **Documentação atualizada**: `docs/especificacoes/marketing/gestor-trafego.md` ganhou bloco "Onda 3" no topo; `docs/especificacoes/transversais/mapa-ui.md` ganhou linha dedicada para a Onda 3 em `/ads`.
7. **Memória de governança** criada e indexada: `mem://constraints/ads-no-global-and-avisos-not-proposals`.

### Preservado intencionalmente (não destrutivo)

- Tabela `ads_autopilot_insights` mantida em banco como histórico congelado — não recebe mais writes do ciclo vivo, não aparece na UI.
- Edge functions `ads-autopilot-weekly-insights`, componente `AdsInsightsTab` e hook `useAdsInsights` deixados no repositório para referência histórica (sem chamadas vivas).

### Próximos passos sugeridos (fora desta onda)

- Quando Aviso virar Proposta automaticamente, marcar o aviso original como `status='converted'` + `converted_to_action_id`. A coluna já existe; só falta o gatilho no momento em que o ciclo cria a proposta a partir de um aviso preexistente. Aguardando observação do uso real antes de implementar.
- Limpeza definitiva do código morto (`ads-autopilot-weekly-insights`, `AdsInsightsTab`, `useAdsInsights`) só após 30 dias de estabilidade, para garantir reversibilidade.

### Status

✅ Ondas 1, 2 e 3 entregues. Aguardando validação de uso real.
