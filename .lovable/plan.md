# Plano — Onda E: Modo Piloto vs Modo Piloto Inicial + análise inicial manual

**Status:** Entregue 2026-06-10. Sucessora da Onda D (config Meta persistida).

## Entregue

### E.1 — Diálogo de ativação com duas opções
- Ao ligar o switch da IA pela primeira vez (ou após desligar), abre `AdsAIActivationDialog`.
- Modo Piloto: ativa a IA e segue o fluxo normal. **Não chama IA. Não cria `analysis_run`.**
- Modo Piloto Inicial (Recomendado): ativa a IA e dispara `ads-ai-initial-analysis` com `trigger=activation_initial`, `scope=account`.
- O auto-disparo do Strategist em `useAdsAccountConfigs.toggleAI` foi **removido**. O fluxo só roda IA quando o usuário escolhe explicitamente.

### E.2 — Botão manual "Rodar análise inicial agora"
- Componente `AdsAIManualAnalysisButton` renderizado no card da conta Meta quando a IA está ativa.
- Confirmação obrigatória antes de executar.
- Tratamento de duplicidade: se já existe execução `running` para o mesmo escopo → toast informativo; se concluída há <24h → diálogo extra pedindo confirmação para rodar novamente (`force=true`).

### E.3 — Edge Function `ads-ai-initial-analysis` (produção)
- Cria `ads_ai_analysis_runs` (status `running`).
- Reaproveita o `ads-autopilot-strategist` (`trigger=start`, `target_account_id`) como motor real — não duplica lógica de contexto.
- Persiste `account_snapshot_summary`, `input_config_snapshot`, `limitations`, `diagnosis_summary`, `strategy_summary`, `created_action_ids`.
- Bloqueia execução duplicada via **unique index parcial** em `(tenant, platform, ad_account_id|__global__, scope) WHERE status IN ('queued','running')`.
- Não publica. Não chama Meta/Google/TikTok para mutação. Não gera criativo final automaticamente.

### E.4 — Persistência (`ads_ai_analysis_runs`)
- Tabela real de produção, com RLS por tenant.
- Campos: `tenant_id, platform, ad_account_id, scope, trigger, status, started_at, finished_at, input_config_snapshot, account_snapshot_summary, diagnosis_summary, strategy_summary, risks, limitations, created_action_ids, session_id, error_message, created_by`.
- Auditoria + histórico + base para UI mostrar resumo amigável.

### E.5 — Camada de contexto (AdsStrategyContextBuilder)
- `collectStrategistContext` no `ads-autopilot-strategist` é a camada canônica. A análise inicial não duplica — chama o Strategist.
- A edge `ads-ai-initial-analysis` apenas captura snapshot resumido (configs Meta + production_config) para auditoria humana, sem inventar dados.

### E.6 — Hook + tipos
- `useAdsAIAnalysisRun({ platform, adAccountId, scope })`: lista runs recentes, retorna `latestRun`/`hasRunning`, expõe `run.mutate({ scope, ad_account_id, trigger, force })`, e faz polling de 5s enquanto houver execução em andamento.

### E.7 — Escopo
- `account` (Meta + conta específica): diálogo de ativação + botão manual por card de conta.
- `global` (correção 2026-06-10, v1.1.0 da edge): novo botão `AdsAIGlobalAnalysisButton` no topo do Gerenciador de Anúncios. Itera todas as contas Meta com IA ativada, reusa `runForAccount`, cria 1 run parent (`scope=global`) + N runs filhas (`scope=account`, `parent_run_id` no snapshot). Google/TikTok ignorados com limitação amigável: "Google Ads e TikTok Ads ainda não estão operacionais nesta etapa."
- Dedup global: unique index parcial em `(tenant, platform, COALESCE(ad_account_id,'__global__'), scope) WHERE status IN ('queued','running')` cobre tanto run parent quanto filhas. Contas já em execução são puladas sem quebrar o lote.
- Resumo amigável: `buildHumanContextSummary` monta linha por conta ("Esta análise considerou: conta Meta act_..., orçamento R$ ..., ROI alvo ..., país BR, idade 18-65, posicionamentos Advantage+, CTA ..., formato ..., diretrizes configuradas."). Vai para `strategy_summary` da run parent e `account_snapshot_summary.per_account[].context_summary`. Payload técnico bruto permanece em `input_config_snapshot`.

## Restrições respeitadas
- Zero publicação Meta/Google/TikTok.
- Zero mutação na conta de anúncios real.
- Zero criativo final gerado automaticamente.
- Zero crédito consumido fora da chamada estratégica única autorizada pelo usuário.
- Modo Piloto não chama IA.
- Nenhuma análise dispara ao abrir/navegar/salvar.
- Dedup garantido por unique index (não depende de race no app).
- Global ignora Google/TikTok sem bloquear Meta.

## Não entregue (fora do escopo desta onda)
- Cron mensal automatizado de análise.
- Admin completo de compatibilidade.
- Google/TikTok operacionais.
- Painel de histórico detalhado das runs (a tabela existe; UI mínima foi adicionada via `latestRun.finished_at` no botão).


---

## Correção 2026-06-10 — Configurações Gerais focada em estratégia

**Status:** Entregue.

### Mudança
- Configurações Gerais do Gestor de Tráfego IA passa a ser **exclusivamente estratégica** (orçamento, ROI, ROI por funil, estratégia, splits, prompt, ativação, execução diária, Modo Piloto / Piloto Inicial).
- Removido da UI principal o formulário manual `MetaProductionConfigCard` (Página, Pixel, Instagram, evento de conversão, IDs técnicos, públicos, posicionamentos, CTA/formato default).
- Substituído por status inline somente leitura (`MetaIntegrationStatusInline`): "Meta conectada · ativos sincronizados" ou alerta de pendência com link para `/integrations`.

### Preservado
- Tabela `ads_meta_production_config`, hook `useAdsMetaProductionConfig`, componente `MetaProductionConfigCard` (não removido — apenas desconectado da UI principal, disponível para área técnica futura).
- `collectStrategistContext` continua lendo a configuração interna quando existir.
- Gates por etapa (`strategy` / `creative` / `publish`) inalterados — ausência de Pixel/Página continua sendo limitação, não bloqueio de análise.
- Modo Piloto, Modo Piloto Inicial, análise manual, `ads_ai_analysis_runs`, propostas Aguardando Ação e ownership Campanha → Conjunto → Anúncio intactos.

### Docs atualizados
- `docs/especificacoes/transversais/mapa-ui.md` (seção "Status técnico Meta na UI estratégica").
- `docs/especificacoes/marketing/gestor-trafego.md` (D.3 reescrito).
