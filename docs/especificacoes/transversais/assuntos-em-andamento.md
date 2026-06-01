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
- **Arch18 Fase A — Catalog Base Forced** agora é **padrão universal** (Reg #28). Flag `arch18_catalog_base_forced` virou kill-switch.
- **Cobertura universal de canais (Reg #29)** — IA agora responde de forma automática em: WhatsApp, E-mail, Chat, Messenger, Instagram DM, Comentários do Instagram, Comentários do Facebook, Mercado Livre (perguntas), Shopee (chat) e TikTok Shop (chat). Entrega de saída unificada no `channel-dispatcher`. Webhooks só ingerem e disparam o gate; nunca enviam direto.
- **Scrub determinístico de marketplace (Reg #28)** ativo para ML/Shopee/TikTok/comentários: remove links externos, telefones e e-mails.
- Pipeline base consolidada: TPR (Gemini Flash-Lite), State Machine, Working Memory (shadow), Focus Snapshot, Catalog Probe, Output Gates, Anti-repetição, Handoff terminal, Variant Gate, Ambiguous Input Detector, Turn Orchestrator.
- Modo Vendas (`sales_mode_enabled`) ativa 11 tools de comércio conversacional.
- **Provedor de IA travado em OpenAI (Reg #40, 24/mai/2026):** o agente de produção (WhatsApp/Web) e o chat de teste do Comando Central agora usam **exclusivamente OpenAI direta** (modelos GPT-5-mini para chat/busca, GPT-4o para imagem, GPT-4o-mini para "pensar mais"). O chat de teste estava em Lovable AI Gateway/Gemini e batia rate limit, dando impressão de "IA muda". Unificado para que o teste reflita exatamente o que o cliente recebe. Regra anti-regressão registrada em `mem://constraints/ai-provider-openai-locked` — proibido trocar de provedor sem pedido explícito do operador.

**Incidente aberto (24/mai/2026) — Quota OpenAI esgotada:**
- Após a unificação, tanto o agente de produção quanto o chat de teste passaram a retornar **429 `insufficient_quota`** da OpenAI em todos os modelos.
- Causa raiz: a chave `OPENAI_API_KEY` configurada na plataforma está **sem créditos / fora do limite de billing da conta OpenAI**. Não é problema de código.
- Ação pendente do operador: acessar `https://platform.openai.com/account/billing`, validar cartão, recarregar créditos ou aumentar o limite mensal. Após isso, aguardar 1–2 minutos e testar.
- Pergunta em aberto ao operador: incluir um **aviso visível no chat de teste** quando a falha for de quota (em vez de balão vazio), para diagnóstico imediato em incidentes futuros.

**Próximos candidatos (a combinar com operador):**
- Validar saída em conversa real por canal (sandbox Meta + perguntas reais ML/Shopee/TikTok) **após** restauração da quota OpenAI.
- Avançar para Arch18 Fase B (Policy Compiler) e B2 (Model Roles).

**Restrições firmes:**
- Nada novo sem autorização do operador.
- Toda mudança em pipeline/gates exige Reg # no changelog.
- Mudanças com risco de regressão cross-módulo viram constraint em `mem://constraints/` antes de fechar.
- Piloto continua sendo só Respeite o Homem para flags Arch18.
- **Provedor de IA é OpenAI direta — não migrar para gateway, Gemini, Anthropic ou similar sem pedido explícito do operador (Reg #40).**


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

1. **Integração WMS Pratika (apps externos):** conexão SOAP ativa e validada. Fluxo é **reativo, não na emissão**: o XML da NF-e é enviado ao WMS quando a Sefaz autoriza a nota (síncrono ou assíncrono via webhook/polling), e a etiqueta dos Correios é enviada quando o código de rastreio é registrado. Idempotência por log do tenant + travas `auto_send_nfe`/`auto_send_label` + reconciliação automática a cada 30 min cobrindo últimas 24h. Validação E2E: NF 349 de saída autorizada e despachada ao WMS com sucesso (27/05/2026). Pendente: validação E2E da etiqueta dos Correios em produção. Detalhes: `mem://features/external-apps/wms-pratika-integration`.

2. **Catálogo de Naturezas de Operação — expansão concluída:**
   - Filtro de "Remessa" no editor de NF-e estava restrito a 4 tipos (escondia Demonstração, Consignação, Bonificação, Amostra Grátis).
   - Filtro foi corrigido para considerar a faixa oficial da Receita Federal (CFOPs 5900–5999), independente de "faturada".
   - Catálogo do tenant ampliado de **18 → 33 naturezas**, cobrindo todos os 25 CFOPs oficiais da faixa de remessa (Armazém Geral, Industrialização por Encomenda, Comodato, Exposição/Feira, Vasilhame/Sacaria, Conta e Ordem de Terceiros, etc.).
   - Todas as novas naturezas entram com CSOSN 400 (Simples Nacional, não tributado por remessa), CST PIS/COFINS 49, marcadas como não faturadas e não consumidor final.
   - Doc oficial atualizado com a faixa oficial e a lista completa.

**Pendente:**
- Validação real ponta a ponta da etiqueta: emitir uma remessa Correios no tenant piloto, registrar o rastreio e confirmar envio automático ao WMS Pratika. (NF-e de saída já validada com a NF 349 em 27/05/2026.)
- Avaliar, em outra rodada, se a expansão do catálogo deve virar default para novos tenants ou ficar opt-in via Fiscal → Configurações → Naturezas de Operação.

**Restrições firmes:**
- Não mexer em natureza de operação por iniciativa própria — usuário edita pela tela de Configurações.
- Não criar UI nova para "forçar reenvio ao WMS" sem autorização — fluxo é automático no momento da emissão.
- Mudanças no filtro do editor de NF-e ou na lista oficial de CFOPs precisam atualizar o doc fiscal na mesma entrega.

---

### 6. Frenet como Gateway de Despacho Automático — Bloqueio por Credencial de Parceiro

**Docs oficiais:**
- `docs/especificacoes/logistica/` (gateway de envio)
- Memória: `mem://features/logistics/gateway-vs-local-shipping-routing`

**Onde estamos:**
- Decisão de negócio (operador): seguir o **caminho 1** — solicitar credencial de parceiro à Frenet e manter o fluxo automático de envio de pedidos pagos ao painel da Frenet (gateway de despacho), e não apenas cotação/rastreio.
- Diagnóstico técnico concluído: o consumidor da fila lia colunas de endereço que não existem mais e o host da API estava errado. Os dois pontos foram corrigidos no código.
- Bloqueio real: o endpoint de inserção de pedido no painel da Frenet exige hoje um **token de parceiro whitelabel (`x-partner-token`)** que o sistema ainda não possui. Sem esse token, nenhum pedido pago entra automaticamente no painel da Frenet — o tenant Amazgan é o caso atual em aberto (2 pedidos pagos sem despacho automático).

**Onda 1 — pendente de execução autorizada:**
- Pausar o consumidor da fila Frenet para parar o loop de retentativa.
- Marcar os 2 pedidos pagos do Amazgan como "aguardando integração de parceiro" (sem perder rastro, sem reprocessar em loop).
- Documentar no doc oficial de Logística — Gateway de Envio que o fluxo automático Frenet depende de credencial de parceiro e está em espera.
- Registrar constraint anti-regressão.

**Onda 2 — quando o token chegar:**
- Cadastrar `FRENET_PARTNER_TOKEN` como secret.
- Adaptar o conector ao endpoint oficial que a Frenet fornecer junto com a credencial.
- Reabrir a fila, reenfileirar os pedidos parados e validar ponta a ponta com um pedido do Amazgan aparecendo no painel da Frenet com referência externa.

**Pendente do operador:**
- Solicitar à Frenet a credencial de parceiro (whitelabel) e o endpoint oficial de inserção de pedidos.
- Autorizar a execução da Onda 1 (parar o loop e marcar os pedidos como aguardando integração).

**Restrições firmes:**
- Não reabrir o consumidor da fila Frenet sem o token de parceiro válido configurado.
- Não tratar pedidos do Amazgan manualmente sem registro — todo pedido parado fica visível na fila como "aguardando integração de parceiro".
- Cotação e rastreamento Frenet continuam funcionando normalmente — o bloqueio é só do despacho automático (inserção de pedido no painel).
