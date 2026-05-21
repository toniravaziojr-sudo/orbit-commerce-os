# Assuntos em Andamento

**Status:** Documento oficial do sistema (Layer 3 — transversal).
**Finalidade:** Manter visíveis as frentes de trabalho ativas, pendências e backlog declarado, servindo como memória explícita de continuidade entre sessões.

---

## Regra de Manutenção (obrigatória)

1. **Só entra um assunto neste doc quando o operador pedir explicitamente** — frase como *"grava este tema X em Assuntos em Andamento"* ou equivalente.
2. **Só sai um assunto deste doc quando o operador pedir explicitamente** — frase como *"remove o tema X de Assuntos em Andamento"* ou equivalente.
3. **A IA nunca adiciona, edita ou remove itens por iniciativa própria**, mesmo que o assunto pareça concluído, abandonado, duplicado ou superado.
4. Não há rotação automática, não há limite de quantidade, não há expiração.
5. Atualizações de status dentro de um item (ex: "F2.6 virou 🟢 GO") podem ser feitas pela IA, mas somente quando o operador confirmar a mudança de estado no chat.

---

## Assuntos Ativos

### 1. Motor de Créditos — Fase F2 (cobrança de custos da plataforma)

**Doc oficial:** `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`

**Status por sub-fase:**
- **F2.5** — `send-system-email` → 🟢 GO (validado 07/05/2026, 2 envios reais SendGrid).
- **F2.6** — `command-insights-generate` + `ai-learning-aggregator` → 🟢 GO funcional final (07/05/2026). Validação real ponta a ponta no tenant Respeite o Homem; tenant não foi cobrado; idempotência confirmada.
- **F2.7** — 🔒 Pendente de GO explícito do operador. Próximo passo: iniciar em modo PLANNER (somente diagnóstico) para mapear a próxima edge candidata a `recordPlatformCost`.

**Achados paralelos NÃO corrigidos (pendentes de autorização):**
- Cron `generate-weekly-insights` cai em "Manual call" → 401 silencioso (refatorar a edge, não o cron).
- `get_auth_user_email` retorna `permission denied` na tela `/platform/emails` (task `b70aa82b`).

**Restrições firmes:**
- Não corrigir os achados paralelos sem autorização.
- Não iniciar F2.7 sem autorização.
- Toda nova fase começa em PLANNER, executa só após GO.
- Nunca processar mais de 1 tenant em validação real.
- Nunca apagar linha real de `platform_cost_ledger`.

---

### 2. IA de Atendimento e Vendas — Evolução da Pipeline

**Docs oficiais:**
- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (changelog Reg # de toda a pipeline)
- `docs/especificacoes/crm/crm-atendimento.md` (§4.2 handoff, §4.6 scrubber, §4.8 ambiguous)
- `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md`
- `docs/especificacoes/ia/motor-contexto-comercial.md`
- `docs/especificacoes/ia/visao-ia-produto.md`

**Onde estamos:**
- **Arch18 Fase A — Catalog Base Forced** ativa **somente** no piloto Respeite o Homem (flag `arch18_catalog_base_forced` em `ai_support_config.metadata`).
- Pipeline base consolidada: TPR (Gemini Flash-Lite), State Machine, Working Memory (shadow), Focus Snapshot, Catalog Probe, Output Gates (Price Scrubber, Greeting Mirror, Checkout URL Enforcer, Action Invention Scrubber), Anti-repetição semântica, Handoff terminal idempotente, Variant Gate, Ambiguous Input Detector, Turn Orchestrator.
- Modo Vendas (`sales_mode_enabled`) ativa 11 tools de comércio conversacional no WhatsApp.

**Próximos candidatos (a combinar com operador):**
- Promover Arch18 Fase A para outros tenants.
- Avançar para Arch18 Fase B (Policy Compiler).
- Avançar para Arch18 Fase B2 (Model Roles).

**Restrições firmes:**
- Nada novo sem autorização do operador.
- Toda mudança em pipeline/gates exige Reg # no changelog.
- Mudanças com risco de regressão cross-módulo viram constraint em `mem://constraints/` antes de fechar.
- Piloto continua sendo só Respeite o Homem para flags Arch18.

---

### 3. Módulo "Saúde de SEO" por Tenant — Backlog

**Status:** Backlog declarado pelo operador. **Não iniciar implementação até pedido explícito.**

**Contexto:** O verificador de SEO da Lovable cobre apenas o site da plataforma (`app.comandocentral.com.br`). Tenants já têm campos de SEO por entidade (produto, categoria, página, blog), geração com IA, sitemap/robots por loja, OG e favicon multi-tenant — mas **não têm um diagnóstico consolidado** com nota, lista de problemas e correção rápida.

**Escopo previsto:**
- Nota geral da loja.
- Lista de problemas agrupados por tipo (loja, páginas, produtos, categorias, blog).
- Botão de correção rápida via IA reaproveitando a geração de SEO já existente.
- Re-scan sob demanda.
- Rollout em ondas: começar pelo essencial (título, descrição, OG, sitemap, robots, alt) e crescer para Schema.org de produto, breadcrumb, performance, links quebrados.

**Regra:** Não iniciar, não propor implementação, não sugerir prazo. Apenas lembrar deste backlog quando o assunto SEO de tenants voltar à mesa ou quando o operador pedir explicitamente.

---

### 4. Fiscal de Marketplaces + Cálculo Automático de Impostos

**Docs oficiais:**
- `docs/especificacoes/erp/erp-fiscal.md` (Ondas 4 e 5)
- `docs/especificacoes/marketplaces/mercado-livre.md` (seção "Pedidos na Esteira Fiscal")
- `docs/especificacoes/marketplaces/shopee.md` (seção "Pedidos na Esteira Fiscal")
- `docs/especificacoes/transversais/mapa-ui.md` (banner e botão "Vincular produto" em `/orders/:id`)

**Onde estamos:**
- **Fase 1 — Pedidos de marketplaces na esteira fiscal:** ✅ aplicada. Pedidos ML/Shopee sem SKU vinculado ficam **pendentes** com banner + botão "Vincular produto" na UI. Após vínculo manual, esteira fiscal é reativada.
- **Fase 2 — Cálculo automático de PIS/COFINS/ICMS por regime:** ✅ aplicada. Engine compartilhado com precedência **Override de Produto > Default do Tenant > Zero**. Settings de "Tributos" só visíveis para Regime Normal (CRT 3). Simples Nacional mantém lógica de zero-tax.
- **Fase 3 — Consolidação documental:** ✅ concluída.

**Pendente:** Validação real ponta a ponta pelo operador — pedido ML sem vínculo de SKU, vínculo manual, emissão de NF com regime Normal e overrides de produto.

**Restrições firmes:**
- Nada de tocar nas configurações de imposto sem autorização (impacta diretamente cálculo de NF-e).
- Validar sempre no tenant Respeite o Homem antes de qualquer expansão.

---

### 5. Fiscal — Integração WMS Pratika + Catálogo de Naturezas de Operação

**Docs oficiais:**
- `docs/especificacoes/erp/erp-fiscal.md` (catálogo de naturezas e filtros do editor de NF-e)
- Memória: `mem://features/external-apps/wms-pratika-integration`

**Onde estamos (tenant piloto: Respeite o Homem):**

1. **Integração WMS Pratika (apps externos):** conexão SOAP ativa e validada. Envio automático de NF-e e etiqueta dos Correios para o WMS ao emitir nota fiscal **de saída**. Conexão testada com sucesso.

2. **Catálogo de Naturezas de Operação — expansão concluída:**
   - Filtro de "Remessa" no editor de NF-e estava restrito a 4 tipos (escondia Demonstração, Consignação, Bonificação, Amostra Grátis).
   - Filtro foi corrigido para considerar a faixa oficial da Receita Federal (CFOPs 5900–5999), independente de "faturada".
   - Catálogo do tenant ampliado de **18 → 33 naturezas**, cobrindo todos os 25 CFOPs oficiais da faixa de remessa (Armazém Geral, Industrialização por Encomenda, Comodato, Exposição/Feira, Vasilhame/Sacaria, Conta e Ordem de Terceiros, etc.).
   - Todas as novas naturezas entram com CSOSN 400 (Simples Nacional, não tributado por remessa), CST PIS/COFINS 49, marcadas como não faturadas e não consumidor final.
   - Doc oficial atualizado com a faixa oficial e a lista completa.

**Pendente:**
- Validação real ponta a ponta pelo operador: emitir uma NF de remessa (ex.: Armazém Geral) no tenant piloto e confirmar que (a) aparece no editor, (b) é autorizada pela Sefaz, (c) chega ao WMS Pratika automaticamente.
- Avaliar, em outra rodada, se a expansão do catálogo deve virar default para novos tenants ou ficar opt-in via Fiscal → Configurações → Naturezas de Operação.

**Restrições firmes:**
- Não mexer em natureza de operação por iniciativa própria — usuário edita pela tela de Configurações.
- Não criar UI nova para "forçar reenvio ao WMS" sem autorização — fluxo é automático no momento da emissão.
- Mudanças no filtro do editor de NF-e ou na lista oficial de CFOPs precisam atualizar o doc fiscal na mesma entrega.
