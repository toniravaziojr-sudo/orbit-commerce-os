# Plano — Ownership de campos por nível no Motor de Propostas

**Status:** Onda C entregue em 2026-06-10 (sobre as Ondas 0/A/B mínima anteriores).

## Entregue nesta rodada

### C.1 — Objective Mapper + adapter Meta
- Novo módulo `src/lib/ads/platform/metaAdapter.ts`:
  - Enum canônico interno único: `sales | leads | traffic | awareness | engagement | app_promotion`.
  - `inferCanonicalObjective()` reconhece canônico, label PT-BR ("Vendas"), enum oficial Meta (`OUTCOME_SALES`) e legados curtos (`SALES`).
  - `translateObjectiveToMeta()` traduz para o enum oficial da plataforma.
  - Funções equivalentes para CTA, evento de conversão, posicionamentos e formato criativo, preparando Google/TikTok para adapters próprios.
- Platform Compatibility Gate (`gates/platformCompatibility.ts`) agora **sempre traduz** antes de comparar. Erro técnico "SALES não suportado" deixou de aparecer; quando o objetivo não é mapeável, devolve mensagem amigável PT-BR.

### C.2 — Contrato canônico v2.1 (ownership por nível)
- `CampaignNode` perdeu `destination_url` e `cta` como campos principais. Em vez disso ganhou `inherited_destination_url` e `inherited_cta` — populados apenas quando o payload legado guardou link/CTA no topo.
- `AdNode` é a fonte de verdade do **Criativo**: `cta`, `destination_url` e o novo `tracking_params` vivem aqui.
- Adapter `normalizeCampaignStructure`: ao detectar link/CTA no topo do payload, propaga para os anúncios que não trouxeram seu próprio valor e **também** registra como herança no nó Campanha (só para leitura).

### C.3 — UI por nível
- **Aba Campanha** não exibe mais "Link de destino" e "Botão de ação" como configuração principal. Quando há herança legada, surge um bloco secundário "Resumo herdado dos anúncios" com a etiqueta explícita (do anúncio).
- **Aba Conjunto** mostra selo **"Pendente · Obrigatório"** (vermelho) no lugar de `—` para campos obrigatórios pendentes (região, idade, gênero, posicionamentos, otimização, evento de conversão). Os blockers do gate alimentam essa marcação.
- **Aba Anúncio** foi dividida visualmente em dois blocos: **Anúncio** (nome, conjunto vinculado, status) e **Criativo do anúncio** (CTA, link, tracking, copy, formato, prompt, referência). Árvore lateral continua com um único "Anúncio N".
- `GateIssue` v2 carrega `node_type`, `node_id`, `message`, `technical_reason`, `suggested_action` e `kind` — base para apontar bloqueios para o nó certo.
- Botão **"Ajustar proposta"** lê `node_type` do primeiro blocker e rola o editor estruturado até a seção certa (campanha / conjunto / anúncio). Nada de formulário genérico.

### C.4 — Strategist
- Prompt do `strategic_plan` agora exige `objective` no enum canônico interno (`sales`, `leads`, `traffic`, `awareness`, `engagement`, `app_promotion`). A descrição deixa explícito que o adapter traduz para o enum oficial — a IA nunca grava `OUTCOME_SALES`. Vale para futuras gerações; nenhuma proposta foi regerada nesta entrega.

### C.5 — Testes e documentação
- Novo arquivo `src/test/ads-meta-adapter.test.ts` (8 testes) cobre Objective Mapper e Compatibility Gate v2 — incluindo regressão do erro "SALES não suportado".
- Suíte completa atualizada: **26/26 testes passando** (`ads-meta-adapter`, `ads-gates`, `normalize-campaign-structure`).
- Docs atualizados:
  - `docs/especificacoes/marketing/gestor-trafego.md` — seção "Motor de Propostas — Onda C" com Field Ownership Matrix, Objective Mapper, GateIssue v2 e regras de UI.
  - `docs/especificacoes/marketing/plataformas-baseline.md` — tabela canônico ↔ Meta/Google/TikTok com regra de comparação.
  - `docs/especificacoes/transversais/mapa-ui.md` — comportamento das três abas + "Ajustar proposta" com foco.

## Restrições respeitadas
- Zero chamada de IA ao abrir, navegar, editar ou salvar rascunho.
- Zero criativo gerado.
- Zero publicação Meta/Google/TikTok.
- Zero consumo de crédito.
- Sem cron mensal, sem admin completo, sem Google/TikTok operacional.
- Sem regeneração de proposta atual; apenas o adapter, gates e UI mudaram.
- Compatibilidade com payloads legados mantida.

## Ondas futuras
- Cron mensal de verificação automática de baseline.
- Tela de admin "Compatibilidade das Plataformas".
- Snapshot real de Google Ads e TikTok Ads.
- Adapters compiladores (publicação real).
