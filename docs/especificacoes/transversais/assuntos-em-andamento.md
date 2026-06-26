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

### 5. Frenet como Gateway de Despacho Automático — Bloqueio por Credencial de Parceiro

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

---

### 6. Tráfego Pago com IA — Política de Execução Segura + Gestor de Tráfego IA (Propostas, Editor e Versionamento)

**Docs oficiais:**
- `docs/especificacoes/marketing/gestor-trafego.md` (seções da Fase B e Fase B.1)
- Memória correlata: `mem://features/marketing/ai-traffic-manager`

**Objetivo da frente:**
Tornar o Autopilot de tráfego pago seguro o suficiente para evoluir gradualmente para autonomia por categoria, sem risco de pausa/ajuste indevido em conta real de cliente. Hoje toda ação ainda exige aprovação humana — o motor funciona como **portão de segurança determinístico**, não como autonomia.

**Onde paramos (estado atual):**

- **Fase A — Planejamento da política (PLANNER):** ✅ concluída. Regras de negócio aprovadas: limites por plataforma (Meta 20%/72h, Google 20%/7d, TikTok 15%/48h), janela segura 00:01–04:00 BRT, TTL de aprovação 24h, categorias de ação (pausa, reativação, ajuste de orçamento), rejeições por contexto ausente / limite excedido / módulo desligado / aprovação expirada.
- **Fase B — Fundação técnica (EXECUÇÃO):** ✅ concluída e validada.
  - Novas colunas de auditoria e agendamento na tabela de ações do Autopilot (agendamento, aprovação, expiração, resultado da política, versão do motor, idempotência).
  - Motor determinístico compartilhado (`_shared/ads-policy.ts`) com decisões: `execute_now`, `schedule`, `reject_*`. Sem LLM, sem chamada externa.
  - Executor de ações aprovadas passou a revalidar a política **antes** de qualquer chamada à API da plataforma de anúncios. Ação bloqueada nunca chega à Meta/Google/TikTok.
  - Runner agendado (cron 5 min) processa só ações marcadas como `v1`, ignora legado.
  - Hook de aprovação grava `approved_at` + `approval_expires_at` (24h), **nunca grava `executed_at` falso**.
- **Fase B.1 — Hardening (EXECUÇÃO):** ✅ concluída.
  - Runner valida `is_ai_enabled=true` e `kill_switch=false` antes de processar.
  - Aprovações legadas sem `approved_at` e com mais de 24h viram `expired_approval` em vez de carimbo retroativo.
  - Suíte de testes unitários do motor de política (30 testes cobrindo limites, janela segura BRT, decisões).
  - Teste de contrato do executor garantindo que só `execute_now` chama API externa.
  - Doc oficial de gestor de tráfego atualizado com Fase B e B.1.

**Validação técnica registrada:**
- Schema, índices, helper, executor, runner e hook validados via consulta real ao banco e leitura de código. Lacuna declarada: cenários de ponta a ponta (A–F) não foram disparados em conta real para evitar risco.

- **Fase C.3.1 — Bloco Observacional (EXECUÇÃO):** ✅ concluída.
  - Motor passou a calcular, para cada ação elegível, qual seria a decisão se o modo `technical_only` estivesse ativo (`would_decision`), e registra esse cálculo em `policy_check_result.observation` **sem executar nada**.
  - Allowlist observacional in-code criada (vazia nesta entrega), com guarda dupla por `is_ai_enabled` e `kill_switch`.
  - Testes cobrindo os cenários principais (allowlist vazia, tenant fora, tenant dentro, ação inelegível). Documentação oficial atualizada.
- **Fase C.3.2 — Ativação Observacional no tenant piloto Respeite o Homem (EXECUÇÃO):** ✅ concluída.
  - **Etapa 1 (preparação silenciosa):** tenant Respeite o Homem adicionado à allowlist observacional; conta Meta `act_251893833881780` movida para `autonomy_mode='technical_only'`. `is_ai_enabled` permaneceu `false` (sem geração de propostas ainda).
  - **Etapa 2 (ativação real observacional):** conta Meta do tenant ligada (`is_ai_enabled=true`) com `human_approval_mode='all'`. A IA passou a gerar propostas reais que **continuam exigindo aprovação manual**; em paralelo o motor registra observações do que faria se a autonomia estivesse ativa. Kill switch e demais contas/tenants intocados.

**Estado atual — janela de observação aberta:**
- Tenant piloto: **Respeite o Homem**, somente canal **Meta** (`act_251893833881780`).
- Modo: **observacional** — IA propõe, humano aprova; nada é executado automaticamente.
- Onde o operador acompanha: tela **Anúncios** (`/ads`) → abas **Ações da IA**, **Aguardando Ação** e **Calendário**. Toda sugestão fica enfileirada para aprovação manual.
- Critério para avançar: manter a janela aberta por no mínimo **7 dias** ou até acumular **~30 ações observadas**, o que vier por último. Depois, leitura conjunta dos resultados (qualidade das sugestões, taxa de aprovação/rejeição, padrões) antes de decidir sobre a Fase C.4.

**Próxima fase recomendada (Fase C.4 — não iniciar sem GO explícito):**
- Após leitura da janela observacional, decidir quais categorias de ação podem virar autônomas (`auto_approved`) e em quais limites — mais restritos que os atuais.
- Observabilidade: painel de decisões da política (executadas, agendadas, rejeitadas, expiradas) por tenant e por plataforma.
- Hardening adicional sugerido na validação: estender índice diário para cobrir payloads que só trazem `meta_campaign_id`/`campaign_id`; reforçar carimbo de aprovação retroativa; testes de integração em sandbox.

**Pendências do operador:**
- Acompanhar as sugestões na tela de Anúncios durante a janela observacional.
- Sinalizar quando a janela puder ser fechada para análise conjunta dos resultados.
- Após a leitura, definir o desenho da Fase C.4 (categorias, limites e tenant piloto de autonomia real).

**Restrições firmes:**
- Autonomia automática segue **desligada**. Nenhuma ação é executada sem aprovação humana, mesmo no tenant piloto.
- Allowlist observacional contém **apenas** Respeite o Homem; nenhum outro tenant pode ser adicionado sem GO explícito.
- Apenas o canal **Meta** do tenant piloto está ativo no modo observacional. Google e TikTok seguem inalterados.
- Nenhuma UI nova foi criada nesta frente — o operador acompanha pelas telas existentes do módulo de Anúncios.
- Ações legadas (sem `policy_engine_version='v1'`) **não** são processadas pelo runner novo.
- Toda evolução para Fase C.4 exige PLANNER antes de EXECUÇÃO, e GO explícito do operador.
- Mudança de limite de plataforma, janela segura, TTL de aprovação, allowlist ou modo de autonomia exige aprovação explícita — não alterar por iniciativa própria.

---

#### Gestor de Tráfego IA — Modal de proposta, editor estruturado e versionamento (Frentes 4.2 / 4.3 / 4.4)

**Aberto em:** 08/06/2026
**Status:** ⏸️ Pausado por decisão do usuário em 09/06/2026 — ajuste técnico aplicado, pendente de validação visual no painel `/ads`.

**Resumo executivo do que já foi feito:**

- **Frente 4.1 — Inteligência comercial + Fit Gate (concluída e ativa):**
  - Classificação automática de oferta: produto base, kit unitário de apresentação, kit de quantidade ou recompra/retenção.
  - Regra: qualquer kit cujo componente base apareça com quantidade > 1 é tratado como kit de quantidade e é considerado inadequado para público frio (Product/Funnel Fit Gate em modo *soft-block*).
  - Badge de "Adequação" (alta / baixa / bloqueada) no card da proposta e bloqueio do botão "Aprovar e gerar criativos" quando há desencaixe.
  - Proposta legada "Kit 3x" para público frio foi arquivada como rejeitada (auditoria). Foi inserida uma proposta sintética nova de validação: **Prospecção Frio — Kit Banho Calvície Zero Dia** (1× Shampoo + 1× Balm), que dispara "Adequação alta".

- **Frente 4.2 — Modal "Ver conteúdo completo" reorganizado (concluída, pendente de validação):**
  - Layout vertical em blocos: Resumo, **Campanha** (nome, objetivo, canal, orçamento diário, link de destino clicável, CTA), Produto e oferta, Público, Criativo e copy, Riscos e Detalhes técnicos (recolhido por padrão).
  - Payload técnico bruto deixou de aparecer no corpo principal — fica só dentro de "Detalhes técnicos".
  - Imagem de referência do produto continua aparecendo, mas como referência visual (não como criativo gerado).

- **Frente 4.3 — Editor estruturado de ajuste (concluída, pendente de validação):**
  - Botão "Ajustar" das propostas da Etapa 1 (`two_step_v1`) deixou de abrir caixa de texto livre e passou a abrir um **drawer lateral à direita** com a proposta inteira em campos editáveis, dividida em 5 blocos: Campanha, Produto e oferta, Público, Criativo e copy, Feedback para a IA.
  - Canal/plataforma permanece como somente leitura nesta versão.
  - "Salvar rascunho" persiste o ajuste em banco e recarrega ao reabrir, **sem chamar a IA**.
  - "Gerar proposta revisada" é a **única** ação que chama a IA (1 vez), criando uma nova versão filha (v2, v3, …) e marcando a anterior como `superseded`. A antiga some automaticamente da fila "Aguardando Ação". Histórico cumulativo de ajustes é mantido.
  - Validações de UI: campos obrigatórios, link com `http(s)`, exigência de observação quando o motivo é "Outro", e bloqueio quando o Fit Gate retorna desencaixe.
  - Propostas legadas (fora de `two_step_v1`) continuam usando o ajuste em texto livre antigo.
  - Etapa 2 do fluxo `two_step_v1` permanece intocada.

- **Frente 4.4 parcial — Feedback em Aprovar/Rejeitar (já existia, mantido):**
  - Diálogo de feedback no Aprovar (opcional) e Rejeitar (obrigatório: chips + observação) continua funcionando como antes via `useAdsAutopilotFeedbackGate`.
  - No editor estruturado, o feedback de ajuste vai junto com o patch da revisão.
  - **Não entregue ainda:** o Strategist ainda não consome o feedback acumulado para reaprender; o contrato e o histórico estão prontos, mas a injeção no prompt da IA fica para uma frente futura.

**Validação pendente do usuário no painel `/ads` → aba "Aguardando Ação" → proposta "Prospecção Frio — Kit Banho Dia":**
1. Abrir "Ver conteúdo completo" e conferir o bloco "Campanha" novo (link clicável, CTA traduzido) e o bloco "Detalhes técnicos" recolhido.
2. Clicar em "Ajustar" e conferir que abre o drawer lateral (não o textarea antigo), com canal em cinza.
3. Editar o nome da campanha → deve aparecer o contador "1 campo alterado".
4. "Salvar rascunho" → toast confirma; fechar e reabrir mantém o ajuste; nenhum criativo/crédito é consumido.
5. "Gerar proposta revisada" → confirmar → a v1 some e aparece uma v2 nova na fila.
6. Confirmar que o badge de "Adequação" e o bloqueio do botão Aprovar continuam respeitando o Fit Gate dentro do editor.

**Restrições que precisam ser mantidas quando o assunto for retomado:**
- Sem Nova Estratégia, sem alterar C.4, toggles de autoexecução, Tenant Memory, F.1/F.2 ou cadência semanal/mensal.
- Sem gerar criativo real, sem consumir crédito, sem publicar campanha, sem chamar Meta/Google/TikTok.
- Sem expor payload técnico bruto fora do bloco "Detalhes técnicos".
- A imagem de referência do produto não pode ser removida — só apresentada como referência.
- Editar/abrir/salvar rascunho = 0 chamadas IA. Só "Gerar proposta revisada" chama (1 vez).
- Regra anti-regressão do Product/Funnel Fit Gate vive **apenas** em `docs/especificacoes/marketing/gestor-trafego.md` §13/§14 e `docs/especificacoes/transversais/mapa-ui.md` — proibido criar `mem://constraints/...` para isso.

**Onde paramos exatamente (ponto de retomada):**
- Ajuste técnico das Frentes 4.2, 4.3 e 4.4 parcial está **aplicado e buildado**, **aguardando o usuário validar visualmente** os 6 itens acima.
- Próximos blocos previstos quando o assunto for retomado:
  - Concluir a Frente 4.4 fazendo o Strategist consumir o feedback acumulado nos prompts.
  - Avaliar se canal/plataforma deve virar editável.
  - Eventual Frente 4.5 (Nova Estratégia) — ainda **não aprovada**.

