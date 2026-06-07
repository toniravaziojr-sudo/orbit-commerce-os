# Assuntos em andamento

---

## 1. Painel de SEO unificado + Indexação Google (NOVO — em pausa, aguardando retomada)

### Status: Auditoria concluída — plano de construção pendente de aprovação

### Contexto
Hoje o SEO do sistema está espalhado e incompleto. Lojas estão aparecendo no Google sem favicon há mais de 30 dias (caso `respeiteohomem`), e não há uma central única para o lojista cuidar de SEO de forma assistida por IA.

### O que já existe
- Botão "Gerar SEO com IA" (Gemini 2.5 Flash) em produtos, categorias, páginas e blog — funciona por item.
- Tags básicas no HTML do storefront: title, meta description, canonical, Open Graph, Twitter, favicon multi-size, manifest.
- Google Search Console integrado na aba Integrações — mostra cliques, impressões, CTR, posição e queries.
- Favicon multi-tenant via Worker + edge `storefront-favicon` (funciona, mas tamanho atual 32×32 está abaixo do mínimo de 48×48 recomendado pelo Google).

### O que falta para fechar 100%
1. **Função de solicitação de indexação/reindexação no Google** (crítico — pedido explícito do usuário).
2. **Sitemap.xml por tenant** servido no domínio da loja (crítico — hoje Google descobre URLs organicamente, lento e incompleto).
3. **Painel de SEO unificado** com: saúde geral, itens pendentes de SEO, KPIs do Search Console, insights de IA, ações rápidas (gerar em lote, solicitar indexação), alertas.
4. **Geração de SEO em lote por IA** (hoje é só item-a-item).
5. **Favicon ≥ 96×96** e padronização de og:image.
6. **Dados estruturados Schema.org** (JSON-LD para Product, Organization, BreadcrumbList) — hoje ausentes, causando perda de rich snippets.
7. **Escopo OAuth `webmasters`** no Google (hoje só temos `search_console`, que é read-only) para habilitar submissão de sitemap e indexação.
8. **IA recomendada:** Gemini 2.5 Flash (mesma já usada no botão atual) — sem necessidade de OpenAI.

### Caso Respeite o Homem (gatilho do tema)
- Favicon configurado corretamente no banco, entregue corretamente pelo Worker, crawlado com sucesso pelo Googlebot.
- Mesmo assim Google ainda exibe "sem favicon" — provável combinação de: tamanho abaixo do mínimo + cache histórico antigo do Google + ausência de reindexação manual.
- Ação imediata sugerida (ainda não aprovada): subir favicon para 96×96 ou 192×192 e solicitar reindexação no Search Console.

### Pendências bloqueantes para retomada
- **Aprovar plano de construção do Painel de SEO** (escopo, fases, ordem).
- **Decidir UX:** painel novo dedicado ou expansão da aba Integrações > Search Console?
- **Decidir se a função de indexação fica restrita a admin** ou disponível para todo lojista.
- **Confirmar escopo:** entra geração em lote já na v1 ou só na v2?

### Como retomar
1. Reler este bloco + memória `mem://features/storefront/favicon-multi-tenant-standard`.
2. Reler `docs/especificacoes/storefront/favicon-multi-tenant.md`.
3. Decidir UX (painel novo vs. aba expandida) com o usuário.
4. Montar plano em fases (Fase 1: favicon + indexação manual; Fase 2: sitemap + dashboard; Fase 3: insights IA + batch).

---

## 2. Integridade Fiscal × Logística (em pausa)

### Status: Proteções estruturais aplicadas — retomar se reaparecer

### Contexto
Durante o E2E da Pratika (Respeite o Homem, 2026-06-05) foram descobertos três gaps estruturais entre Fiscal e Logística usando o pedido real #583 da Maria (em vez de uma duplicação como deveria ser o teste):

1. NF cancelada deixava etiqueta despachada ativa, sem nenhum aviso.
2. Objeto de postagem podia existir sem Remessa agrupadora, ficando visível em "Objetos" e invisível em "Remessas".
3. PV permanecia desaparecido da listagem mesmo após o cancelamento da NF (problema de UI já tratado em entregas anteriores; modelo PV × NF coexistente é o correto).

### Correções aplicadas nesta rodada (2026-06-05)
1. **Limpeza pontual #583 Maria:** NF cancelada removida, objeto e remessa órfãos apagados, PV 395 voltou para "Em aberto / Pronto para emitir".
2. **Auto-cura do agrupador:** todo objeto com rastreio passa a ter, na mesma transação, uma Remessa agrupadora válida. Garantido por gatilho no banco.
3. **Proteção de exclusão de Remessa:** agrupador com objetos ativos vinculados não pode ser apagado (mensagem PT-BR para o operador).
4. **Cascata no cancelamento da NF:** rascunhos são deletados, objetos despachados ganham flag "exige ação / NF cancelada".
5. **Documentação:**
   - `docs/especificacoes/erp/logistica.md` §"Integridade Objeto × Agrupador × NF".
   - `docs/especificacoes/erp/erp-fiscal.md` §"Cascata para a Logística ao cancelar a NF".
   - `mem://constraints/shipping-remessa-self-heal-and-cancel-cascade` (nova).
   - Índice de memórias atualizado.

### Pendências em aberto (para retomada futura, se reaparecer)
- **UI da aba Logística:** ainda não existe banner visual para objetos com `requires_action=true / invoice_cancelled`. Hoje a flag fica no banco e bloqueia, mas o operador precisa entrar no detalhe para entender o motivo. Decisão de UX pendente com o usuário.
- **Listagem de PV após NF cancelada:** confirmar com o usuário se a coexistência PV (em aberto) + NF (cancelada) deve aparecer com badge explícito na lista de PVs ou apenas no detalhe.
- **Política de teste E2E:** padronizar que todo teste fiscal seja feito sobre PV duplicado, nunca sobre pedido real — para evitar repetir o cenário Maria.

### Como retomar
Se houver novo bug nessa interface Fiscal × Logística:
1. Reler este plano + `mem://constraints/shipping-remessa-self-heal-and-cancel-cascade` + `mem://constraints/fiscal-pv-and-nf-coexistence-partial-indexes`.
2. Verificar se as três proteções estruturais ainda estão ativas no banco (gatilhos `trg_ensure_shipment_has_remessa`, `trg_guard_remessa_deletion` e a cascata em `fiscal-cancel`).
3. Decidir junto ao usuário se as pendências de UI acima entram no escopo.

---

## 3. Gestor de Tráfego com IA — piloto C.3.2 (Etapa 4 entregue — observação acoplada)

### Status: Decisão simulada acoplada às propostas elegíveis. Aguardando ciclos automáticos gerarem a primeira ação técnica de orçamento.

### O que estava quebrado nesta etapa
Após a Etapa 3 corrigir o gate dos crons (2026-06-07 manhã), o motor passou a gerar propostas, mas o campo "decisão simulada" (`policy_check_result.observation`) continuava vazio. Motivo: o conector entre a função de decisão e a anexação da observação ainda estava em modo de preparação (legado da Etapa 1), passando contexto vazio.

### Correção aplicada (Etapa 4 — 2026-06-07)
1. Criado helper central de acoplamento no policy engine, que recebe a proposta + config da conta, chama a função de decisão real e mescla a observação no registro antes do INSERT.
2. As duas funções que geram propostas (analisador e estrategista) agora delegam para esse helper central.
3. Mapeamento determinístico: execute_now → "execute_now", schedule → "schedule" + data sugerida, qualquer reject → "reject", sem decisão → "insight", contexto faltando → "skipped_insufficient_context".
4. 38 testes verdes na suíte do bloco observacional (12 novos para o helper central).
5. As 4 propostas das últimas 24h são todas de tipo `create_campaign` e `generate_creative` — **fora do escopo observável** por design (escopo só inclui ações técnicas de orçamento Meta). Não foram alteradas retroativamente.

### Garantias preservadas
- Autoexecução continua desligada (hardcoded false).
- Nenhuma chamada externa de modificação à Meta.
- Nenhum `auto_executed`/`executed_simulated`/`executed_at` é marcado pelo helper.
- Google e TikTok continuam fora. Outro tenant não é afetado.
- Executor e scheduled-runner continuam ignorando o campo `observation` (auditoria apenas).
- Leak de autoexecução: 0.

### Janela de observação oficial
Continua reiniciando a partir da **primeira observation válida gravada**. Hoje (2026-06-07) ainda é 0 porque as propostas geradas até agora são todas de tipos fora do escopo. A contagem oficial começa quando a IA propuser a primeira ação técnica de orçamento Meta.

### Pendências para acompanhamento
- Confirmar nas próximas 24–72h que os crons automáticos geram alguma ação técnica de orçamento Meta para o piloto, populando enfim o campo observation com `would_*` real.
- Aprovações humanas das 2 propostas de criação de campanha pendentes ficam a critério do usuário; o sistema não vai executar sozinho.
- Próxima frente (não desta entrega): habilitar coleta de contextos faltantes (histograma horário, CPA de referência, snapshot de orçamento atual) para reduzir casos de `skipped_insufficient_context`. Pré-requisito da futura Fase C.4 (autoexecução real), que continua bloqueada.

### Documentação atualizada
- `docs/especificacoes/marketing/gestor-trafego.md` — nova seção "C.3.2 — Etapa 4: Acoplamento de `decide()` ao bloco observacional".
- Memória `mem://constraints/ads-autopilot-activation-gate-parity` mantida (regra anti-regressão da Etapa 3).

