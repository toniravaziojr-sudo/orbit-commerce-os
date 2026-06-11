# ERP (Fiscal, Financeiro, Compras) — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção) — Fiscal ✅ Ready

> **Camada:** Layer 3 — Especificações / Erp  
> **Migrado de:** `docs/regras/erp.md`  
> **Última atualização:** 2026-04-14


## Visão Geral

Módulo de gestão empresarial: fiscal (NF-e via **Focus NFe**), financeiro, e compras/estoque.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Fiscal | `/fiscal` | ✅ Ready (Focus NFe) |
| Financeiro | `/finance` | 🟧 Pending |
| Compras | `/purchases` | 🟧 Pending |
| Logística | `/shipping` | 🟧 Pending (ver logistica.md) |

---

## 1. Fiscal

### Modelo de CFOP — Fonte única: Natureza de Operação (v2026-05-25)

A partir desta versão, **o CFOP de qualquer nota fiscal vem exclusivamente da Natureza de Operação vinculada à nota**, decidindo automaticamente entre o CFOP intra (5xxx) ou inter (6xxx) pela comparação entre a UF do emitente e a UF do destinatário.

Regras permanentes:

- O cadastro de produto **não carrega mais CFOP**. Permanecem nele: NCM, CEST, Origem, GTIN, Unidade Comercial e Peso.
- As Configurações Fiscais **não carregam mais CFOP global**. Em seu lugar existe o seletor **"Natureza padrão para vendas automáticas"**, usado pelo motor quando uma nota é gerada automaticamente (pedido pago → NF).
- Cada tenant recebe automaticamente o catálogo padrão de 16 Naturezas-sistema (Venda, Transferência, Devolução, Remessa, Bonificação etc.). As naturezas-sistema não podem ser excluídas; podem ser desativadas. O tenant pode criar as suas próprias.
- No editor de NF, ao escolher/trocar a Natureza ou alterar a UF do destinatário, o CFOP de todos os itens é recalculado automaticamente.
- **Override manual permitido por item**, com badge "manual" e botão "Restaurar" para voltar ao CFOP padrão da natureza.
- Hierarquia de resolução da natureza no motor de emissão: ID/nome explícito → padrão do tenant → "Venda de Mercadoria" do sistema → fallback 5102/6102.



### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Fiscal.tsx` | Dashboard fiscal (abas: Pedidos em Aberto, Notas Fiscais). Botão "Configurações" navega para `/fiscal/configuracoes?from=fiscal` |
| `src/pages/FiscalSettings.tsx` | **Página dedicada** de Configurações Fiscais — 3 abas: Configurações Fiscais (emitente), Natureza Jurídica, Outros. Botão "Voltar" contextual via `?from=`. Acessada pelo módulo Fiscal. |
| `src/pages/SystemSettings.tsx` | **Casa oficial** das configurações (rev 2026-04-17c) — abas Pagamentos e Fiscal. A aba Fiscal renderiza os mesmos componentes (`EmitenteSettings`, `OperationNaturesContent`, `OutrosSettings`) embutidos, sem redirecionamento. URL: `/system/settings?tab=fiscal&aba=<emitente\|natureza\|outros>`. |
| `src/components/fiscal/settings/EmitenteSettings.tsx` | Aba Emitente — dados da empresa, endereço, regime tributário, certificado A1 |
| `src/components/fiscal/settings/OperationNaturesContent.tsx` | Aba Natureza Jurídica — gestão das naturezas de operação |
| `src/components/fiscal/settings/OutrosSettings.tsx` | Aba Outros — inutilização de numeração, automações de emissão/remessa/e-mail, desmembramento de kits |
| `src/pages/FiscalProductsConfig.tsx` | NCM, CEST, Origem, GTIN, Unidade Comercial por produto (CFOP **não** vive mais aqui) |
| `src/components/integrations/FiscalPlatformSettings.tsx` | Config global Focus NFe (token único da plataforma) |

### Atualização em Tempo Real (v8.22.0)

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook / Realtime |
| **Localização** | `src/hooks/useFiscal.ts` → `useFiscalRealtime()` |
| **Contexto** | Usado em `FiscalInvoiceList.tsx` |
| **Descrição** | Escuta mudanças na tabela `fiscal_invoices` via realtime e invalida automaticamente os dados da lista |
| **Comportamento** | Ao receber INSERT/UPDATE/DELETE em `fiscal_invoices`, invalida queries `fiscal-invoices`, `fiscal-stats` e `fiscal-alerts` |
| **Condições** | Tabela `fiscal_invoices` adicionada à publication `supabase_realtime` |
| **Resultado** | O módulo fiscal atualiza automaticamente sem o usuário precisar recarregar a página |


| Função | Descrição |
|--------|-----------|
| `fiscal-sync-focus-nfe` | Sincroniza empresa + certificado na Focus NFe (cria/atualiza `focus_empresa_id`) |
| `fiscal-emit` | Emissão da NF-e via Focus NFe (rota síncrona) |
| `fiscal-submit` | Submissão assíncrona via Focus NFe (cria `focus_ref`) |
| `fiscal-check-status` / `fiscal-get-status` | Polling de status na Focus NFe |
| `fiscal-webhook` | Callback assíncrono da Focus NFe |
| `fiscal-cancel` | Cancelamento de NF-e na Focus NFe |
| `fiscal-cce` | Carta de Correção (CC-e) via Focus NFe |
| `fiscal-inutilizar` | Inutilização de numeração via Focus NFe |
| `fiscal-test-connection` | Validação do token Focus NFe (admin da plataforma) |
| `fiscal-upload-certificate` | Upload do certificado A1 do tenant (sincroniza com Focus automaticamente) |
| `dce-emit` | Declaração de Conteúdo Eletrônica via Focus NFe |
| `fiscal-create-draft` | Cria rascunho de NF-e a partir de pedido |
| `fiscal-create-manual` | Cria NF-e manualmente (sem pedido) |
| `fiscal-auto-create-drafts` | Criação automática de rascunhos (cron 5min + manual) |
| `fiscal-validate-order` | Validação pré-emissão |

### Automação: Fila + Cron (v2026-04-04)

> **Padrão:** Fila + Cron (Padrão 2 — ver `docs/especificacoes/sistema/automacao-patterns.md`)
>
> **Histórico:** Substituiu o antigo trigger `pg_net` (`trg_fiscal_draft_on_payment_approved`) que falhava silenciosamente devido ao limite fixo de 5 segundos e cold starts.

| Campo | Valor |
|-------|-------|
| **Tipo** | Pure SQL Trigger → Fila → Cron |
| **Trigger** | `trg_enqueue_fiscal_draft` em `orders` |
| **Descrição** | Enfileira pedido para criação de rascunho fiscal **e logístico** quando `payment_status` muda para `approved` |
| **Mecanismo** | O trigger insere um registro em `fiscal_draft_queue` **e** `shipping_draft_queue` (INSERT atômico, 100% confiável). O `scheduler-tick` processa ambas as filas: fiscal (fase 1.5) e logística (fase 1.6). Ver `docs/especificacoes/erp/rascunhos-logisticos.md`. |
| **Data da NF** | Usa `paid_at` do pedido (não `now()`) para refletir a data real da venda |
| **Condições** | Dispara somente quando `OLD.payment_status IS DISTINCT FROM 'approved'` AND `NEW.payment_status = 'approved'` |
| **Retry** | Até 5 tentativas com registro de erro em `fiscal_draft_queue.error_message` |
| **Latência** | Até ~1 minuto (próximo tick do scheduler) |
| **Confiabilidade** | 100% na captura (INSERT atômico) + retry automático no processamento |

### Cron: fiscal-auto-create-drafts (processamento da fila + reconciliação)

| Campo | Valor |
|-------|-------|
| **Tipo** | Orquestração interna via scheduler central |
| **Frequência real atual** | Processamento interno a cada 1 minuto via `scheduler-tick` (`* * * * *`). O job direto de 5 minutos para esta rotina foi desativado por segurança. |
| **Descrição** | Rede de segurança — cria rascunhos para pedidos pagos que a fila ou o agendador interno eventualmente não processaram |
| **Modos** | **Cron interno** (via scheduler-tick com credencial interna) / **Trigger interno** (pedido específico) |
| **Data da NF** | Usa `paid_at` do pedido como `created_at` da NF |
| **Anti-duplicação** | Verifica `fiscal_invoices` existentes antes de criar; índice único parcial `idx_fiscal_invoices_order_unique` impede duplicatas; retry com incremento de número |
| **verify_jwt** | `false` (necessário para chamadas internas sem sessão de usuário) |
| **Segurança** | Chamada pública/anon/publishable negada. Execução global só pelo orquestrador interno usando credencial interna (`service_role`). |

#### Pipeline auto-emit (PV → NF → SEFAZ)

Quando o emissor está configurado, `emissao_automatica=true` e o pedido está em `ready_to_invoice`, `fiscal-auto-create-drafts` executa **duas chamadas internas em sequência** (sem chamada manual do usuário):

1. `fiscal-prepare-invoice` — cria a NF (snapshot) a partir do Pedido de Venda (`fiscal_stage='pronta_emitir'`).
2. `fiscal-emit` — transmite a NF criada para a SEFAZ.

Padrão único de header entre edge functions: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`. Por isso `fiscal-emit` e `fiscal-prepare-invoice` ficam com `verify_jwt = false` em `supabase/config.toml` — o gateway rejeitaria a service key (formato `sb_*` não é JWT). A validação de papel (service-role × usuário) e o `tenant_id` ficam dentro das próprias funções. Ver `mem://constraints/edge-internal-call-requires-verify-jwt-false`.

Se a NF nasce com pendências (`fiscal_stage='pendencia'`), o auto-emit é abortado e a NF aparece na Central de Execuções para ação manual; o PV original nunca é alterado.


### Regra: Zero Sync on Load (v8.23.0)

| Campo | Valor |
|-------|-------|
| **Regra** | A tela Fiscal **não** dispara criação de rascunhos ao ser acessada |
| **Motivo** | O backend (fila + cron) já cria rascunhos automaticamente no pagamento aprovado |
| **Frontend** | Apenas lê os dados do banco via query; botão de refresh manual faz `refetch()` sem chamar edge function |
| **Referência** | Regra 3.7 do Doc de Regras do Sistema (Zero Sync on Load) |


### Shared Module: fiscal-numbering.ts
| Função | Descrição |
|--------|-----------|
| `_shared/fiscal-numbering.ts` | Módulo centralizado de numeração fiscal |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Emissão NF-e | ✅ Ready | Via Focus NFe (produção) |
| Sincronização Empresa | ✅ Ready | Cadastro automático na Focus NFe (`focus_empresa_id`) |
| Upload Certificado | ✅ Ready | A1 enviado para Focus NFe (sincronização automática após upload) |
| Cancelamento de NF-e | ✅ Ready | Via Focus NFe (`fiscal-cancel`) |
| Carta de Correção (CC-e) | ✅ Ready | Via Focus NFe (`fiscal-cce`) |
| Inutilização de numeração | ✅ Ready | Via Focus NFe (`fiscal-inutilizar`) |
| Consulta CNPJ | 🟧 Pending | Dados do cliente |
| NCM/CFOP | ✅ Ready | Configuração por produto |
| ICMS/PIS/COFINS | 🟧 Pending | Cálculo automático |
| Manifestação | 🟧 Pending | Aceite de NF |
| Desmembrar Kits | ✅ Ready | Lista componentes separados na NF-e |

### Desmembramento de Kits (Composições)

**Momento de execução — Atualizado 2026-05-20:** o desmembramento de kit acontece **exclusivamente no momento da transição Pedido de Venda → Nota Fiscal** (`fiscal-prepare-invoice`), quando o usuário clica em "Criar Nota Fiscal". **Não acontece mais na criação do Pedido de Venda.**

Regras:

1. **Pedido de Venda preserva o kit como kit** — espelho fiel do pedido do cliente, independentemente da configuração `desmembrar_estrutura`. Não há mais validação de NCM/peso dos componentes ao criar PV.
2. **Decisão sempre atual**: a transição PV → NF lê `fiscal_settings.desmembrar_estrutura` no instante da criação da NF. Mudar a configuração reflete em todas as NFs novas, inclusive geradas a partir de PVs antigos.
3. **Configuração ativa + kit com componentes cadastrados** → a NF nasce com os componentes individuais, cada um com seus dados fiscais (NCM, CFOP override, GTIN, CEST, origem, unidade, CSOSN/CST), com tributos recalculados por componente.
4. **Configuração ativa + kit SEM componentes cadastrados** → a NF nasce com o kit inteiro como um único item; registra evento de auditoria `kit_unbundled` com `kits_without_components` para o lojista cadastrar componentes futuramente.
5. **Configuração desativada** → a NF nasce com o kit inteiro como um único item (igual ao PV).
6. **Rateio proporcional + coerência aritmética por componente (atualizado 2026-06-05)**: o valor total do kit é distribuído entre os componentes proporcionalmente ao preço de venda de cada componente (`product_components.sale_price` → `products.price` como fallback). Para cada componente, o `valor_total` é sempre recalculado como `round2(quantidade × valor_unitario)` — nunca como rateio direto — para garantir que a Sefaz não rejeite por NA01 ("Total do produto difere do produto Quantidade × Valor unitário"). Diferença de centavos do rateio é absorvida ajustando o `valor_unitario` do último componente, preservando exatamente o `valor_total` da NF.
7. **Peso bruto recalculado**: quando há desmembramento efetivo, `peso_bruto`/`peso_liquido` da NF são recompostos a partir do peso dos componentes (mais preciso que o peso registrado no kit).
8. **Pedido de Venda permanece intacto**: a NF é um novo registro filho ligado por `source_order_invoice_id`. O PV pode gerar nova NF/devolução respeitando sempre a configuração e o cadastro do kit no instante da emissão.
9. **Duplicar NF já desmembrada**: a duplicação clona os itens como estão (não re-desmembra, não re-junta).
10. **Validação fiscal pós-desmembramento**: NCM, CFOP, quantidade, valor unitário e descrição são validados sobre os componentes (não sobre o kit), exatamente no mesmo motor de `fiscal-prepare-invoice`. Componente sem NCM cadastrado → NF vai para `pendencia` com mensagem clara apontando o componente. PV original não é afetado.

**Fluxo:**
```
Aba Pedidos de Venda          Configuração     Aba Notas Fiscais
─────────────────────         ───────────       ─────────────────────
Kit "Combo Calvície"  ──►   desmembrar=ON  ──► 3 itens (Shampoo, Loção, Balm)
Kit "Combo Calvície"  ──►   desmembrar=OFF ──► 1 item (Combo Calvície)
```

### Shared Modules: Kit Unbundlers
| Arquivo | Onde roda | Operação |
|---------|-----------|----------|
| `supabase/functions/_shared/kit-unbundler.ts` | **Não utilizado em fluxos de PV/NF** (legado — kept apenas para referência histórica) | Operava sobre `order_items` |
| `supabase/functions/_shared/kit-unbundler-fiscal-items.ts` | `fiscal-prepare-invoice` (PV→NF) | Opera sobre itens já em formato `fiscal_invoice_items`. **Resolução de produto: `fiscal_invoice_items.product_id` direto na linha (fonte única, preenchido na criação do PV em todos os caminhos — automático, manual, duplicado).** Fallbacks legados (`order_item_id`, SKU, prefixo de 8 hex) ficam como rede de segurança para linhas antigas. Expande componentes com tributos recalculados, peso recomposto e auditoria. |



### Código do Produto na NF — SKU do cadastro é fonte única (rev 2026-06-11)

O campo `fiscal_invoice_items.codigo_produto` (que sai no XML, no DANFE e no envio para o WMS Pratika) segue uma regra única e obrigatória em **todos** os caminhos de criação/edição de Pedido de Venda e Nota Fiscal:

1. Se o item tem `product_id` vinculado **e** `products.sku` está preenchido → `codigo_produto = products.sku`. Sempre. Sem exceção.
2. Senão, usa o SKU/código enviado no item — desde que **não** seja apenas o prefixo de 8 caracteres hex do UUID do produto (resíduo do bug histórico).
3. Fallback final: `ITEM-N` (componentes de kit: `COMP-N`). **Proibido** usar `product_id.substring(0, 8)` como código.

**Helper canônico:** `supabase/functions/_shared/fiscal-codigo-produto.ts::resolveCodigoProduto(item, productMap, index)`.

**Pontos obrigatórios de consumo:**
- `fiscal-auto-create-drafts` (PV automático do pedido pago)
- `fiscal-create-draft` (PV manual a partir de pedido existente)
- `fiscal-create-manual` (PV 100% manual via ProductSelector)
- `fiscal-update-draft` (edição de rascunho de PV/NF — refaz lookup ao salvar)
- `_shared/kit-unbundler-fiscal-items.ts` (componentes herdam SKU do cadastro do próprio componente)

Qualquer nova edge function que escreva em `fiscal_invoice_items.codigo_produto` **deve** usar o helper. Code review rejeita `product_id?.substring(0, 8)` em qualquer forma.

**Backfill seguro (idempotente, restrito a rascunhos):**
```sql
UPDATE fiscal_invoice_items fii
SET codigo_produto = p.sku
FROM fiscal_invoices fi, products p
WHERE fii.invoice_id = fi.id
  AND fii.product_id = p.id
  AND p.sku IS NOT NULL AND length(btrim(p.sku)) > 0
  AND fi.status IN ('draft','rejected')
  AND fii.codigo_produto = substring(fii.product_id::text, 1, 8);
```
NF com `status='authorized'` é imutável na SEFAZ — nunca tocar.

**Incidente de origem:** NFs 421 e 422 (Respeite o Homem, jun/2026) saíram com `8259065f` no lugar do SKU `0001` do Shampoo Calvície Zero. O carrinho não persistia SKU no item do pedido e o motor fiscal caía no fallback de UUID, contaminando XML, DANFE e SOAP da Pratika.

**Anti-regressão:** ver memória `mem://constraints/fiscal-item-codigo-produto-sku-cadastro-source-of-truth`.





### Campos Fiscais do Produto
| Campo | Descrição |
|-------|-----------|
| `ncm` | Código NCM (8 dígitos) |

> **Preenchimento automático do NCM nos Pedidos de Venda (todos os canais)**
> Em 2026-05-17 o pipeline de criação de Pedido de Venda foi unificado para garantir que os campos fiscais críticos do item (NCM, CEST, Origem, Unidade) sejam sempre copiados do cadastro do produto no momento em que o pedido entra no módulo Fiscal. Isso vale para pedidos da loja própria e de marketplaces (Mercado Livre, Shopee etc.). A regra de precedência é: `fiscal_products` (override por produto) → `products` (cadastro padrão) → vazio (gera pendência). O fluxo automático (`fiscal-auto-create-drafts`) e o manual (`fiscal-create-draft`) usam a mesma hierarquia. Pedidos antigos foram corrigidos via backfill. A única causa restante de "Pendente por NCM" é produto cadastrado sem NCM — nesse caso, basta preencher o NCM na ficha do produto e o motor de pendências reclassifica o pedido para "Em aberto" automaticamente.
>
> **Hotfix 2026-05-17b — Regressão "Pendente sem NCM" em pedido com cadastro completo.** A unificação acima introduziu uma regressão: os dois motores incluíram a coluna `unit_of_measure` no `select` da tabela `products`. Essa coluna **não existe** em `public.products` (unidade vive apenas em `fiscal_products.unidade_comercial`; padrão é `'UN'`). Resultado: PostgREST devolvia erro silencioso, o `productMap` ficava vazio, o fallback `products.ncm` nunca era consultado e qualquer pedido novo da loja virava "Pendente — Produto X sem NCM válido" mesmo com NCM cadastrado. **Caso conhecido:** Pedido #467 → Pedido de Venda 1-285 (Shampoo Calvície Zero 3x, NCM 33051000 no cadastro). **Correção:** remoção de `unit_of_measure` do select e do mapeamento de unidade nos dois motores; o item afetado foi reprocessado e a pendência caiu. **Anti-regressão:** ver memória `mem://constraints/fiscal-products-select-must-match-real-columns`.
>
> **Hotfix 2026-05-18 — `origin_code` vazio quebra o rascunho silenciosamente.** Quando o cadastro do produto tem o código de origem salvo como string vazia (`""`), os dois motores tentavam gravar esse valor numa coluna numérica (`origem`), o que falhava silenciosamente e o pedido nunca chegava ao módulo Fiscal. **Correção:** o valor de origem agora é convertido com segurança para inteiro (`Number.isFinite` + `Math.trunc`), com fallback `0` para qualquer valor inválido. **Caso conhecido:** Pedido #468 → Pedido de Venda 1-299. Anti-regressão integrada à memória citada acima.
>
> **Hotfix 2026-05-18b — Cidade do cliente com typo derrubava o código IBGE silenciosamente.** A busca do código oficial IBGE do município é feita a partir do nome da cidade digitado pelo cliente; quando não há match (typo, abreviação, acento estranho), o campo ficava vazio sem aviso. O Pedido de Venda continuava como "Em aberto" e a NF chegava em "Pronto para Emitir", mas a SEFAZ recusava na emissão real (campo `cMun` do destinatário é obrigatório). **Correção dupla:** (1) a validação automática de pendências do Pedido de Venda (`compute_pedido_venda_pendencias`) passou a exigir 7 dígitos no `dest_endereco_municipio_codigo`; (2) o motor de preparação da NF (`fiscal-prepare-invoice`) recebeu a mesma checagem antes de mover a NF para "pronta_emitir". **Mensagem PT-BR:** "Cidade do cliente não localizada na base oficial de municípios — confirme a grafia da cidade no endereço." **Caso conhecido:** Pedido #467 (cidade "São Franciaco do Sul"). **Anti-regressão:** ver memória `mem://constraints/fiscal-ibge-destinatario-obrigatorio`.

| `cfop` | Código CFOP |
| `origem` | Origem (0-8) |
| `cest` | Código CEST |
| `csosn` | CSOSN (Simples Nacional) |
| `cst` | CST (Lucro Real/Presumido) |
| `unidade_comercial` | Unidade (UN, KG, etc) |

---

## Integração Focus NFe

> **Provedor único e em produção.** A migração da Nuvem Fiscal foi concluída em 2026-05-04. Não há mais qualquer dependência da Nuvem Fiscal no sistema (código, secrets, banco ou UI).

### Arquitetura de credenciais (rev 2026-05-14)

A integração com a Focus NFe usa **dois níveis distintos** de credencial. Toda chamada a um endpoint Focus precisa declarar o **tipo de operação** (`account_admin` ou `nfe_op`), e o resolver de credenciais escolhe automaticamente o token correto, no ambiente correto, do tenant correto.

#### Nível 1 — Conta Focus (plataforma)

| Secret | Escopo | Uso |
|--------|--------|-----|
| `FOCUS_NFE_TOKEN` | Global da plataforma | **Token principal da conta Focus.** Usado **exclusivamente em operações administrativas da conta**: cadastrar/atualizar empresas (`/v2/empresas`), anexar certificado A1, registrar/consultar webhooks, consultas administrativas. Configurado em **Plataforma → Integrações → Fiscal → Focus**. Nunca é usado para emitir, cancelar, consultar ou corrigir NF-e. |

> Este é o token que aparece **no topo** do painel da Focus NFe ("Token principal produção"). Ele não emite nota — ele administra empresas dentro da conta Focus.

> **Fonte de verdade:** o valor vivo do token é lido de `platform_credentials` (registro `FOCUS_NFE_TOKEN`, `is_active = true`), gerenciado pela tela **Integrações da Plataforma → Fiscal → Focus**. As edge functions fiscais (`fiscal-sync-focus-nfe`, `fiscal-upload-certificate`, `fiscal-webhook-register`, `fiscal-integration-validate`) **devem** chamar `loadPlatformCredentials()` no início do handler antes de resolver `account_admin`. Variável de ambiente `FOCUS_NFE_TOKEN` permanece apenas como fallback inicial — trocar a credencial é feito pelo painel central, sem novo secret e sem redeploy. Proibido pedir secret novo para o usuário quando o registro central já existir.

> **Domínio das chamadas administrativas:** operações `account_admin` (`/v2/empresas`, `/v2/hooks`, etc.) **sempre** rodam contra `https://api.focusnfe.com.br`, mesmo quando o tenant está em homologação. O domínio `https://homologacao.focusnfe.com.br` **não expõe** os endpoints administrativos e responde `404 — endpoint não encontrado` (incidente 2026-05-14). O resolver `resolveFocusCredentials({ operationKind: 'account_admin' })` devolve `baseUrl` já fixado em produção; o cliente `focus-nfe-client` respeita esse `baseUrl` quando presente. Operações `nfe_op` continuam roteadas pelo ambiente do tenant.

#### Nível 2 — Empresa do tenant (por CNPJ)

Cada empresa cadastrada na conta Focus possui **dois tokens próprios**: um de **homologação** e um de **produção**. Esses tokens são **do tenant**, não da plataforma, e ficam armazenados criptografados em `fiscal_settings` do próprio tenant:

| Coluna | Conteúdo |
|--------|----------|
| `focus_token_homologacao` | Token de homologação da empresa do tenant. Usado em toda operação de NF-e em ambiente de homologação. |
| `focus_token_producao` | Token de produção da empresa do tenant. Usado em toda operação de NF-e em ambiente de produção. |

Regras:
- Tokens por empresa **nunca** são armazenados como secret global da plataforma.
- **SELECT** dessas colunas é negado para `anon`/`authenticated`. Frontend nunca lê o valor — apenas o status (configurado / não configurado) via RPC dedicada.
- Gravação só via RPC `SECURITY DEFINER` (`fiscal_set_focus_tenant_token`), que não devolve o valor depois de salvo.
- **Cada tenant usa apenas os próprios tokens da sua empresa.** Não há fallback entre tenants nem entre ambientes.
- **Produção fica bloqueada** se `focus_token_producao` do tenant não estiver configurado, mesmo que o tenant tenha homologação OK.

#### Resolver de credenciais

Toda edge function fiscal declara o tipo de operação ao resolver credenciais:

| Tipo | Quando usar | Token escolhido |
|------|-------------|-----------------|
| `account_admin` | Cadastrar empresa, anexar certificado, registrar/validar webhook, consultar empresa, health check da conta | `FOCUS_NFE_TOKEN` (global) |
| `nfe_op` | Emitir, submeter, consultar, cancelar, CC-e, inutilizar NF-e | Token do tenant no ambiente atual (`focus_token_homologacao` **ou** `focus_token_producao`) |

Se o token exigido não estiver disponível, a operação falha de forma controlada (sem fallback silencioso para o token de outro ambiente ou para o token global).

#### Ambiente fiscal — Produção universal (rev 2026-05-19)

**Decisão definitiva:** o sistema opera **exclusivamente em ambiente de produção**. Homologação não é mais uma opção do sistema.

Regras:
- Toda nova loja já nasce em **produção** (default da coluna `ambiente` e `focus_ambiente` em `fiscal_settings`).
- Existe **trigger BEFORE INSERT OR UPDATE** (`fiscal_settings_force_producao`) que reescreve automaticamente qualquer tentativa de gravar `'homologacao'` para `'producao'`. Funciona como trava anti-regressão: nenhum fluxo, script ou painel consegue voltar uma loja para homologação por engano.
- **Extensão para notas (rev 2026-06-11):** trigger BEFORE INSERT OR UPDATE `trg_fiscal_invoices_force_producao` aplica a mesma trava em `fiscal_invoices`. Se o tenant está em produção e a nota chega com `ambiente='homologacao'`, o valor é reescrito para `producao` e o motivo é anotado em `observacoes` (`[FORCE PRODUCAO] ambiente=homologacao reescrito automaticamente`). Garante que **nenhuma nota** (PV, NF-e ou evento) fique gravada como teste quando a loja já operou virada para produção. Origem: auditoria 2026-06-11 (Respeite o Homem, notas #415/#416/PV #417 gravadas como homologação após virada).
- A UI não expõe mais seletor de ambiente nem mensagens "Pronto para teste / Modo de teste fiscal ativo / Emitir NF-e de teste / NF-e (homologação)". O badge dinâmico foi substituído por **"Produção ativa — valor fiscal real"**.
- Status `ready_for_test` foi mantido no contrato do backend por compatibilidade, mas é renderizado na UI como `ready` ("Pronto para emitir NF-e").
- Coluna `focus_token_homologacao` permanece no schema apenas como histórico — não é mais lida em nenhum fluxo de produção. Pode ser depreciada em onda futura.

**Procedimento aplicado a notas legadas de homologação:** notas que estavam em `status = 'processing'` no ambiente de homologação no momento da virada foram marcadas como `rejected` com `status_motivo = "Emissão de teste em homologação descartada na virada para produção. Reemita esta nota em ambiente de produção."` e `ambiente = 'producao'`. O pedido de origem fica liberado para nova emissão real. Precedente aplicado à NF 1-287 (Respeite o Homem, 2026-05-19).

#### Exclusão de notas fiscais — regra por efeito fiscal (rev 2026-05-19)

Notas fiscais podem ser **excluídas** somente quando **não geram efeito fiscal junto à Sefaz**. A ação é restrita a **Proprietário e Administrador** do tenant — Operadores não excluem em nenhuma hipótese.

**Status que permitem exclusão (sem efeito fiscal):**
- `draft` — Pronta para Emitir / Rascunho (nunca foi transmitida).
- `rejected` — Rejeitada pela Sefaz (não autorizada, sem efeito).
- `cancelled` — Cancelada pela Sefaz após autorização — mas o registro local pode ser removido sem impacto fiscal (a Sefaz já tem o cancelamento autorizado).

**Status que NÃO permitem exclusão (com efeito fiscal):**
- `authorized` — Autorizada (NF válida). Usar **Cancelar NF-e** dentro do prazo legal.
- `processing` / `pending` — Em transmissão. Aguardar resposta da Sefaz.
- Demais status terminais com efeito fiscal.

**Implementação:**
- RLS em `fiscal_invoices` (policy `Owners and admins delete non-fiscal invoices`): `USING (status IN ('draft','rejected','cancelled') AND (has_role owner OR has_role admin))`.
- UI: `InvoiceActionsDropdown` mostra item **"Excluir"** (vermelho) apenas em Pronta para Emitir, Rejeitada e Cancelada. Em Autorizada, mostra **"Cancelar NF-e"** em vez de Excluir.
- Confirmação obrigatória via `window.confirm` antes da remoção. Itens vinculados (`fiscal_invoice_items`) são removidos junto.
- Bulk delete (seleção múltipla) continua restrito apenas a `draft`.

**Por que existe:** evita acúmulo de rascunhos órfãos e notas rejeitadas/canceladas poluindo a aba Notas Fiscais, sem permitir que o lojista remova registros com valor fiscal real.

#### Cancelamento de NF × Objeto Logístico (rev 2026-06-08)

**Trava obrigatória — quando posso cancelar uma NF.** O cancelamento só é
permitido se **não houver objeto de postagem vinculado** OU se o objeto
estiver em um destes estados:

- `draft` — etiqueta ainda em preparo (sem rastreio).
- `label_created` — etiqueta gerada / objeto despachado para a transportadora
  mas **ainda não postado fisicamente**.
- `canceled` — objeto já cancelado.

> ⚠️ **Grafia oficial do status (rev 2026-06-08b):** o valor canônico do
> enum `delivery_status` em `shipments` é `canceled` (um L, padrão
> americano). A grafia `cancelled` (dois L) **não existe** nesse enum e
> qualquer comparação/UPDATE com `'cancelled'` quebra a automação com
> erro de cast (`invalid input value for enum delivery_status`). Atenção
> ao escrever triggers, edge functions e validações na UI. A grafia
> `cancelled` (dois L) só vale para `fiscal_invoices.status` (NF).

Qualquer outro estado (`posted`, `in_transit`, `out_for_delivery`,
`delivered`, `returned`, `returning`) **bloqueia** o cancelamento. A trava é
aplicada em duas camadas: (1) o diálogo de cancelamento na UI faz uma
pré-checagem ao abrir e, se houver bloqueio, oculta o formulário de
justificativa e mostra uma mensagem em destaque; (2) a edge function
`fiscal-cancel` repete a checagem antes de chamar a Focus NFe e devolve
`success: false, code: 'shipment_blocks_cancel'` com a mesma mensagem.

**Mensagens exibidas (PT-BR, sempre com rastreio quando disponível):**

| Estado do objeto | Mensagem |
|---|---|
| `posted` / `in_transit` / `out_for_delivery` | "Não é possível cancelar esta NF: o pedido já foi despachado e está em rota de entrega (rastreio: AP000000000BR). Para cancelar a NF, primeiro cancele o objeto de postagem no módulo de Logística." |
| `delivered` | "Não é possível cancelar esta NF: o pedido já foi entregue ao cliente (rastreio: AP000000000BR, entregue em 08/06/2026). Notas de pedidos entregues não podem ser canceladas — utilize uma NF de devolução se for o caso." |
| `returned` / `returning` | "Não é possível cancelar esta NF: o pedido foi devolvido. Registre uma NF de devolução em vez de cancelar a original." |

**Pós-cancelamento bem-sucedido (com objeto em `label_created` ou sem objeto):**

1. **Objetos vinculados → cancelados.** Todos os shipments referenciando a
   NF (`invoice_id` ou `source_pedido_venda_id`) são marcados com
   `delivery_status = 'canceled'`, `action_reason = 'invoice_cancelled'`,
   `requires_action = false`, e o `invoice_id` é **desligado** (passa a
   `NULL`) — isso libera a exclusão da nota cancelada quando o lojista
   quiser limpar o registro.
2. **PV pai volta para "em aberto", limpo.** A `pendencia_motivos` do
   Pedido de Venda raiz é zerada e o `pedido_status` é recalculado via
   `recompute_pv_pedido_status`. Não é exibida observação extra (nem
   "NF cancelada", nem "Pedido sem itens", nem nada). O PV fica disponível
   para emitir uma nova NF.
3. **NOVO objeto logístico é enfileirado automaticamente (rev 2026-06-11).**
   Logo após o reset do PV, a edge `fiscal-cancel` chama a RPC
   `public.requeue_shipping_draft_for_pv(p_pv_id)` que insere um novo
   rascunho em `shipping_draft_queue` vinculado ao PV. Idempotente
   (respeita o unique parcial `shipping_draft_queue_pv_open_unique`),
   pula PVs roteados para gateway (Frenet) / marketplace e PVs em status
   terminal. **Na mesma execução, o sistema também dispara o processador
   sob demanda do rascunho logístico**, apontando para o PV recém-reaberto,
   para que o objeto volte a aparecer em **Prontos para emitir** em segundos,
   sem depender do cron de segurança. Fecha o ciclo de "reset em 1 clique":
   cancelar a NF errada já devolve o PV pronto para emitir nova NF **e**
   com novo rascunho de etiqueta visível quase imediatamente. O resultado é
   registrado em `fiscal_invoice_events` como `shipping_requeue_after_cancel`.
4. **FK `shipments.invoice_id` agora é `ON DELETE SET NULL`** — exclusões
   futuras da NF cancelada não esbarram em referência pendente.

Anti-regressão: `mem://constraints/nf-cancel-blocked-by-shipment-state`,
`mem://constraints/nf-cancel-reopens-pv-clean`,
`mem://constraints/nf-cancel-requeues-shipping-draft` e
`mem://constraints/shipping-delivery-status-enum-spelling-canonical`.
Casos de origem: PV 403 / NF 404 (2026-06-08, ciclo limpo do PV); pedidos
#612 e #613 (Respeite o Homem, 2026-06-11) — NFs 421/422 emitidas com SKU
errado, justificaram o requeue automático.




#### Ações para NF rejeitada (rev 2026-05-20b)

Quando uma NF está em `rejected`, o `InvoiceActionsDropdown` apresenta três opções, nesta ordem:

1. **Reenviar para SEFAZ** (verde, destacado) — chama `handleQuickSubmit` (invoca `fiscal-submit` com o mesmo `invoice_id`, sem abrir modal de edição). Usado quando a rejeição não foi causada pelo conteúdo da nota: indisponibilidade da SEFAZ, divergência de regime tributário corrigida nas Configurações Fiscais, certificado renovado, etc. A própria edge `fiscal-submit` já aceita `status IN ('draft','rejected')`.
   - **Regra de retry (rev 2026-05-20c):** quando a nota está em `rejected`, `fiscal-submit` e `fiscal-emit` geram um `focus_ref` NOVO (`NFE_<id>_R<epoch36>`) e persistem em `fiscal_invoices.focus_ref`. Isso é obrigatório porque a Focus NFe deduplica por `ref` — POST com ref já visto devolve a resposta em cache sem reenviar à SEFAZ. Primeira emissão continua usando o ref base `NFE_<id>` (idempotente). Webhook casa por `focus_ref`, então o pareamento é preservado. Constraint: `mem://constraints/fiscal-retry-ref-must-be-unique`.
   - **Regra de etapa operacional (rev 2026-05-25):** rejeição nunca pode deixar a nota em **Emitida**. Toda rejeição volta a nota para **Pendência Identificada**, carregando o motivo da rejeição como pendência visível. Depois de editar e salvar, a nota é revalidada automaticamente e volta para **Pronta para Emitir** quando estiver consistente.
2. **Editar** — abre o editor completo; usar quando o motivo da rejeição exige alterar dados da NF (item, destinatário, fiscal).
3. **Duplicar como rascunho** — clona a NF para um novo rascunho preservando o original.

Excluir continua disponível ao final do menu (vermelho).

**Comportamento visual adicional:** quando o usuário reenviա a nota ou atualiza o status manualmente, o indicador de carregamento aparece na própria coluna **Status** da linha, e não apenas dentro do menu de ações.


#### Status atual
- **Respeite o Homem** e demais tenants: ambiente **produção**, emissão real de NF-e habilitada.

#### Pendência futura (não bloqueante)

- Avaliar criptografia em repouso mais forte para `focus_token_homologacao` / `focus_token_producao` — por exemplo Vault ou pgsodium — preservando o contrato atual de RPC. **Não é pré-requisito do piloto**: hoje as colunas já estão protegidas por `REVOKE SELECT` para `anon`/`authenticated` e só são lidas via service_role dentro das edge functions.

### Card "Validação Fiscal" — comportamento e ativação automática (rev 2026-05-14)

Card de saúde mostrado em **Configurações Fiscais**. Resume se a loja está apta a emitir NF-e e cuida do recebimento automático de retornos da Focus NFe.

**Princípio:** o usuário **não precisa clicar em nenhum botão obrigatório** para "ativar recebimento automático de retornos". O backend tenta ativar automaticamente quando todos os pré-requisitos do ambiente atual estiverem completos. O botão manual existe apenas como **fallback de correção** ("Tentar novamente"), e só aparece quando a ativação automática falha ou quando o status atual exige reprocessamento.

**Pré-requisitos para ativação automática (homologação):**
- Empresa fiscal cadastrada localmente (`focus_empresa_id` presente).
- Ambiente atual = `homologacao`.
- Certificado A1 válido (não vencido, CNPJ batendo com o emitente).
- `FOCUS_NFE_TOKEN` (token administrativo da conta) configurado.
- `focus_token_homologacao` do tenant configurado.

**Pré-requisitos para emissão real em produção:**
- Tudo acima, com ambiente = `producao` e `focus_token_producao` configurado.
- Recebimento automático **cadastrado** na Focus, com `webhook_status` em `validated` **ou** `pending`. O status `pending` significa que o cadastro remoto foi feito com sucesso e o sistema está aguardando o 1º retorno real (que só chega quando a 1ª nota é emitida). **Exigir `validated` antes da 1ª emissão cria deadlock permanente** — a Focus só envia o callback que valida o webhook quando há uma emissão real, e a emissão estaria bloqueada esperando o callback. Por isso `pending` é aceito como liberação de produção; após a 1ª emissão bem-sucedida o status migra automaticamente para `validated`.

> **Anti-regressão (rev 2026-05-19):** o portão de emissão (`fiscal-emit`, `fiscal-submit`) e o validador (`fiscal-integration-validate`) aceitam `webhook_status IN ('validated','pending')` em produção. É proibido reintroduzir bloqueio que exija `validated` como pré-condição da 1ª emissão. Caso de origem: tenant "Respeite o Homem", NF #1-289 (mai/2026). Demais pré-requisitos (certificado, CNPJ, empresa na Focus, ambiente, token do tenant) continuam bloqueando normalmente.

**Quando a ativação automática é tentada:**
- Ao chamar **"Validar integração fiscal"** no card.
- Ao salvar credenciais do tenant em "Credenciais do provedor fiscal" (próxima revalidação).
- Sempre que o card detectar `webhook_status` ausente/`error` com todos os pré-requisitos presentes.

A ativação automática reaproveita cadastro existente da Focus para o mesmo CNPJ/URL e nunca duplica hooks. Se houver hook antigo apontando para outra URL/token, ele é substituído com segurança.

**Selo geral do card (`overall_status`):**

| Status | Quando | Cor |
|--------|--------|-----|
| `ready` | Produção com tudo OK e webhook `validated` **ou** `pending` (cadastro remoto confirmado, aguardando 1º retorno) | verde — "Pronto" |
| `ready_for_test` | Homologação com empresa, certificado, token de homologação e webhook `pending`/`validated` | verde — "Pronto para teste" |
| `config_pending` | Falta uma ação objetiva do usuário (ex: token de homologação ausente) | âmbar — "Configuração pendente" |
| `error` | Falha real (cert vencido, falha remota da Focus, erro 401, falha na ativação do webhook) | vermelho — "Erro" |
| `blocked` | **Apenas** em produção quando o webhook nem chegou a ser cadastrado na Focus (sem `hook_id`) ou outro requisito obrigatório falta | vermelho — "Bloqueado" |

Regras importantes:
- Em homologação **não** é mostrado "Bloqueado" se o cenário está pronto para smoke test.
- "Atenção" genérico não é usado: cada item exibe um rótulo específico (ex: "Configure o token de homologação", "Aguardando primeiro retorno", "Aguardando credencial").
- O card não fica todo verde se faltar token de homologação ou outro pré-requisito real — o item correspondente fica em `warn`/`pending` com texto explícito.
- **Anti-regressão (rev 2026-05-14e):** o status geral **nunca** pode ser `ready` ou `ready_for_test` se qualquer item obrigatório (empresa fiscal, certificado, credenciais, recebimento de retornos) estiver em `error`. A presença de tokens salvos **não** substitui a confirmação remota da empresa fiscal: se a empresa estiver "Não localizada" no provedor, o card geral cai em `Configuração fiscal com erro` com botão "Reprocessar configuração fiscal", mesmo com credenciais já capturadas.
- **Confirmação remota da empresa (rev 2026-05-14e):** a verificação `GET /v2/empresas/{id}` usa o ID interno salvo em `focus_empresa_id` (não o CNPJ formatado). Usar CNPJ no path retornava 404 falso-positivo do provedor e gerava "Não localizada" mesmo para empresas válidas.

**Itens internos:**
- **Empresa fiscal cadastrada** diferencia cadastro local de validação remota: quando falta credencial para validar remoto, exibe "Cadastrada / Aguardando credencial" em vez de "Atenção" genérico.
- **Token de homologação/produção da empresa** é exibido como item próprio do card.
- **Recebimento automático de retornos** mostra: "Validado", "Aguardando primeiro retorno", "Erro na ativação", "Configure o token", ou "Não configurado", conforme o caso.

**Produção:**
- `fiscal-emit` / `fiscal-submit` continuam bloqueados quando o webhook **não foi cadastrado** na Focus (sem `hook_id`), certificado é inválido ou `focus_token_producao` está ausente. Webhook em `pending` (cadastrado, aguardando 1º callback) **não bloqueia** — ver pré-requisitos acima.

**Permissões:**
- Operator não vê esta seção (página de Configurações é restrita a owner/admin via `useTenantAccess`).
- Owner/admin podem acionar manualmente "Tentar novamente" quando o sistema sinalizar erro.
- Tokens, PFX, senha e segredo do webhook nunca aparecem na UI, em logs ou em payloads. O fallback manual segue o padrão já aprovado (token por loja mascarado, com ação explícita de revelar/copiar).

### Configuração por Tenant (`fiscal_settings`)
```typescript
{
  tenant_id: uuid,
  provider: 'focusnfe',
  ambiente: 'homologacao' | 'producao',
  certificado_pfx: bytea,         // Certificado A1 (criptografado)
  certificado_senha: text,        // Senha (criptografada via FISCAL_ENCRYPTION_KEY)
  certificado_valido_ate: timestamptz,
  certificado_cnpj: text,
  razao_social: text,
  cnpj: text,
  inscricao_estadual: text,
  crt: integer,                   // 1=Simples, 2=Simples Excesso, 3=Regime Normal
  endereco_municipio_codigo: text,// IBGE
  endereco_*: text,               // Logradouro, bairro, UF, CEP, etc.
  desmembrar_estrutura: boolean,  // Desmembrar kits na NF
  focus_empresa_id: text,         // ID da empresa na Focus NFe
  focus_ambiente: text,           // 'producao' | 'homologacao'
  focus_token_homologacao: text,  // Token NF-e da empresa em homologação (criptografado, sem SELECT para anon/authenticated)
  focus_token_producao: text,     // Token NF-e da empresa em produção (criptografado, sem SELECT para anon/authenticated)
  focus_empresa_criada_em: timestamptz,
  focus_ultima_sincronizacao: timestamptz,
  emissao_automatica: boolean,
  emitir_apos_status: text,
}
```

### Arquitetura Focus NFe

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED MODULES                                │
├─────────────────────────────────────────────────────────────────┤
│  focus-nfe-client.ts        │  focus-nfe-adapter.ts             │
│  ─────────────────────────  │  ────────────────────────────     │
│  • Basic Auth (token único) │  • buildEmpresaPayload()          │
│  • syncEmpresa()            │  • buildNFePayload()              │
│  • sendNFe() (assíncrono)   │  • generateNFeRef()               │
│  • getNFeStatus()           │  • mapFocusStatusToInternal()     │
│  • cancelNFe()              │  • CRT/UF/Payment mappings        │
│  • downloadXML/DANFE        │                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                                │
├─────────────────────────────────────────────────────────────────┤
│  fiscal-sync-focus-nfe      │  fiscal-submit / fiscal-emit      │
│  fiscal-upload-certificate  │  fiscal-check-status              │
│  fiscal-cancel              │  fiscal-get-status                │
│  fiscal-cce                 │  fiscal-webhook                   │
│  fiscal-inutilizar          │  dce-emit                         │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Sincronização (Tenant)
```
1. Tenant configura dados fiscais e faz upload do certificado A1
2. fiscal-upload-certificate dispara automaticamente fiscal-sync-focus-nfe
3. Edge function:
   a. Carrega fiscal_settings + decrypta certificado (FISCAL_ENCRYPTION_KEY)
   b. Resolve código IBGE via RPC
   c. Chama Focus NFe (POST /v2/empresas) com Basic Auth (FOCUS_NFE_TOKEN)
   d. Anexa certificado A1
   e. Persiste focus_empresa_id e focus_ultima_sincronizacao em fiscal_settings
   f. Pós-sync: chama GET /v2/empresas/{id} (snapshot completo) e grava
      certificado_valido_ate, certificado_cnpj e razão social retornados
      pelo Focus em fiscal_settings (POST/PUT podem não devolver esses campos).
   g. Recalcula is_configured = true quando todos os requisitos canônicos
      estão presentes (Razão Social, CNPJ, IE, endereço, série NFe e
      certificado válido). O badge "Pronto/Incompleto" da UI lê esse flag.
```

### Fluxo de Emissão (v2026-05-14 — Onda 2 rev1)
```
1. Pedido pago → trigger trg_enqueue_fiscal_draft enfileira em fiscal_draft_queue
2. scheduler-tick consome a fila e cria registro em fiscal_invoices (fiscal_stage='pedido_venda', status='draft')
3. Usuário clica "Criar Nota Fiscal" → fiscal-prepare-invoice valida localmente
   → fiscal_stage='pronta_emitir' (sem erros) ou fiscal_stage='pendencia' (com pendências)
4. Em "Emitir Nota Fiscal" → fiscal-submit envia à Focus NFe (POST /v2/nfe?ref=<focus_ref>)
   → status='processing', fiscal_stage='emitida'
5. fiscal-webhook OU fiscal-check-status (polling) atualizam status final:
   → 'authorized' mantém `emitida`
   → 'rejected' / 'denied' retornam a nota para `pendencia`, com o motivo salvo para correção
6. nfe-shipment-link (helper) propaga o vínculo para shipments quando autorizada

**Invariante crítico (v2026-06-11):** ao receber `autorizado` da Focus NFe, o `fiscal-emit` PRIMEIRO grava no banco `status='authorized'`, `chave_acesso`, `focus_ref`, `fiscal_stage='emitida'` e `authorized_at`. SÓ DEPOIS dispara os efeitos colaterais (vínculo com remessa, e-mail de NF, envio Pratika), cada um em try/catch isolado. Falha em qualquer side-effect é apenas logada — nunca reverte o estado fiscal. Quebrar essa ordem causa a regressão "NF autorizada na SEFAZ, mas banco mantém `draft`/`pronta_emitir`", bloqueando re-emissão. Constraint: `mem://constraints/fiscal-emit-persist-authorized-before-side-effects`.

```

### Mapeamento de Status NF-e (Sefaz → Interno)
| Status Sefaz | Status Interno |
|--------------|----------------|
| `autorizada` | `authorized` |
| `rejeitada` | `rejected` |
| `denegada` | `denied` |
| `cancelada` | `cancelled` |
| `processando` | `processing` |

### Integração Status Pedido ↔ NF-e (v2026-03-10)

O fluxo fiscal é diretamente integrado ao ciclo de vida do pedido. A coluna `status` do pedido reflete a etapa fiscal-operacional interna.

#### Fluxo Completo (Pedido → Fiscal → Logística)
```
awaiting_confirmation → ready_to_invoice → invoice_pending_sefaz → invoice_authorized → invoice_issued → dispatched → completed
                                                   ↓                        ↓
                                            invoice_rejected         invoice_cancelled
```

#### Mapeamento Pedido ↔ Fiscal
| Status do Pedido | Significado | Ação Fiscal |
|------------------|-------------|-------------|
| `awaiting_confirmation` | Aguardando pagamento | Nenhuma |
| `ready_to_invoice` | Pago, pronto para NF | Criar rascunho de NF-e |
| `invoice_pending_sefaz` | NF enviada à SEFAZ | Aguardar retorno |
| `invoice_authorized` | NF autorizada pela SEFAZ e enviada ao cliente | NF aprovada com sucesso |
| `invoice_issued` | NF impressa, preparando despacho | Preparar envio |
| `dispatched` | Pacote despachado | — |
| `completed` | Entregue ao destino | — |
| `invoice_rejected` | SEFAZ rejeitou NF | Corrigir e reemitir |
| `invoice_cancelled` | NF cancelada pós-autorização | Emitir NF de cancelamento |
| `returning` | Em devolução | Emitir NF de devolução |
| `payment_expired` | Pagamento expirado | Nenhuma |

#### Transições Automáticas
| Gatilho | Transição |
|---------|-----------|
| Webhook de pagamento aprovado | `awaiting_confirmation` → `ready_to_invoice` |
| PIX/Boleto expirado | `awaiting_confirmation` → `payment_expired` |
| fiscal-auto-create-drafts (auto-emissão ativa) | `ready_to_invoice` → `invoice_pending_sefaz` |
| Trigger `trg_enqueue_fiscal_draft` | Pagamento aprovado → enfileira na `fiscal_draft_queue` |
| scheduler-tick (processa fila + reconciliação) | Consome `fiscal_draft_queue` e cria rascunhos pendentes |

#### Regras
1. **Separação de colunas**: `status` = etapa operacional interna. `shipping_status` = status de entrega. `payment_status` = status de pagamento.
2. **Automação**: Transição para `ready_to_invoice` é automática via webhook de pagamento.
3. **Criação de rascunho fiscal — Single Flow (v2026-04-08, rev. 2026-05-13)**: O fluxo de criação de rascunhos fiscais é **restrito obrigatoriamente** à pipeline `SQL Trigger → Fila → Scheduler interno → Edge Function`. Chamadas públicas, anon, publishable ou acionamento manual global por usuário para `fiscal-auto-create-drafts` são **proibidas** para eliminar risco de segurança e condições de corrida. O trigger `trg_enqueue_fiscal_draft` captura 100% dos pagamentos aprovados via INSERT atômico na `fiscal_draft_queue`. O `scheduler-tick` processa a fila a cada minuto e também reconcilia pedidos órfãos. (Padrão Fila + Cron — ver `automacao-patterns.md`)
4. **Anti-duplicação via índices únicos parciais (v2026-05-13 — Onda 1.A; **revisado 2026-06-05 — Onda Pratika**)**: A regra "um ativo por pedido" agora é aplicada **separadamente** para Pedido de Venda e Nota Fiscal, permitindo a coexistência obrigatória dos dois registros sobre o mesmo pedido (modelo Bling).
   - `idx_fiscal_invoices_order_unique_pv` em `(tenant_id, order_id) WHERE fiscal_stage = 'pedido_venda' AND status NOT IN ('cancelled','rejected') AND order_id IS NOT NULL` — impede dois PVs ativos para o mesmo pedido.
   - `idx_fiscal_invoices_order_unique_nf` em `(tenant_id, order_id) WHERE fiscal_stage <> 'pedido_venda' AND status NOT IN ('cancelled','rejected') AND order_id IS NOT NULL` — impede duas NFs ativas para o mesmo pedido.
   - O índice agregado anterior `idx_fiscal_invoices_order_unique` foi removido — ele bloqueava incorretamente a criação da NF quando já existia o PV do mesmo pedido. Notas `cancelled` e `rejected` continuam não contando como ativas. Conflitos nos novos índices continuam sendo tratados como "registro já existente" (fetch silencioso).

   **Status canônico (v2026-05-13 — Onda 1.A)**: Os valores hoje permitidos em `fiscal_invoices.status` pela CHECK constraint são `draft`, `pending`, `authorized`, `rejected`, `cancelled` (com 2 L's). A grafia `canceled` (1 L) está **bloqueada por CHECK constraint no banco** e foi migrada retroativamente para `cancelled`. Observação: o código fiscal também usa `processing` e `error` em fluxos auxiliares/legados, então a constraint ainda precisa ser saneada no próximo lote para alinhar banco e backend sem risco.

    **Duplicar Pedido de Venda / Duplicar NF (v2026-05-14 — Onda 2 rev1)**: A duplicação abre um diálogo pré-preenchido (`ManualInvoiceDialog` em `mode="duplicate"`) para o usuário revisar/editar antes de salvar; só ao clicar em **"Salvar duplicação"** o novo registro é criado.

### Status visual do Pedido de Venda (v2026-05-20 — Onda 3 rev3)

A aba **Pedidos de Venda** exibe 7 status. A fonte de verdade é `fiscal_invoices.pedido_status`, mantido pelos gatilhos `trg_orders_sync_pv_status` (espelha o pedido original) e `fiscal_invoices_sync_pv_status` (recalcula quando uma NF filha é criada, alterada ou excluída — vale também para PVs **manuais/duplicados sem `order_id`**). Cálculo central: `public.derive_pv_pedido_status(...)`.

| Status | Cor | Quando | Bloqueia emissão? |
|--------|-----|--------|-------------------|
| **Pedido em aberto** | Azul | Aprovado, sem pendências, sem NF gerada | Não |
| **Pendente** | Amarelo | Há pendências fiscais (peso, NCM, CPF, endereço) **ou** todas as NFs filhas foram excluídas e o pedido voltou para revisão | **Sim** |
| **NF criada** | Roxo | Existe ao menos uma NF filha **não cancelada e não autorizada** (rascunho, pronta, pendente Sefaz, rejeitada) | Não — permite ajustar/reenviar |
| **Concluído** | Verde | Existe ao menos uma NF filha autorizada pela Receita | Não — permite NF complementar/devolução |
| **Cancelado** | Cinza | Pedido original cancelado/expirado/devolvido | Sim |
| **Chargeback em andamento** | Laranja | Pedido em disputa ativa | Sim |
| **Chargeback perdido** | Vermelho | Pedido perdeu a disputa (terminal) | Sim |

**Transições automáticas** (qualquer origem de PV — manual, duplicado, vindo de loja/marketplace):

- NF filha **criada** (`draft`/`ready`/`pending`/`rejected`) → PV vira **NF criada**.
- NF filha **autorizada** → PV vira **Concluído**.
- Última NF filha **excluída** → PV volta para **Em aberto** (ou **Pendente** se houver pendência fiscal local).
- **Duplicar um PV não copia o vínculo de NF** — o duplicado nasce sem `source_order_invoice_id` apontando para ele, portanto sempre "Em aberto"/"Pendente".
- Precedências: `cancelado`/`chargeback_perdido` do pedido original **sempre prevalecem** sobre qualquer estado de NF.

**Vínculo PV ↔ NF na UI**: o editor do Pedido de Venda mostra um bloco roxo "Vinculado à Nota Fiscal nº X" listando todas as NFs filhas ativas e seus status. Se a única NF filha foi excluída/cancelada, exibe aviso amarelo "Gere uma nova Nota Fiscal".

- Filtros, cards de resumo e badge da linha consomem a mesma fonte (`PEDIDO_STATUS_CONFIG`).
- Motor de pendências é puro SQL (sem `pg_net`, sem cron); recomputa em INSERT/UPDATE de `fiscal_invoices` e itens.
    - **Aba Pedidos de Venda** (`fiscal_stage='pedido_venda'`): item **"Duplicar Pedido de Venda"** no menu de ações. Ao salvar, o novo registro permanece como **Pedido de Venda** (`fiscal_stage='pedido_venda'`), não muda de aba.
    - **Aba Notas Fiscais** (`fiscal_stage='emitida'`): item **"Duplicar NF"** no menu de ações. Ao salvar, o novo registro é validado automaticamente pelo backend (`fiscal-prepare-invoice`) e movido para a aba **Notas Fiscais** com `fiscal_stage='pronta_emitir'` ou `fiscal_stage='pendencia'` conforme o resultado da validação. **Nunca** volta para Pedidos de Venda.
    - Ao salvar, o backend chama `fiscal-create-manual` seguido de `fiscal-prepare-invoice` — **nunca** `fiscal-submit`, `fiscal-emit`, `fiscal-cancel`, CC-e, inutilização ou qualquer rota Focus/Sefaz.
    - **A duplicação sempre gera um registro novo e independente**: número fiscal novo via `getNextFiscalNumber` (nunca reaproveita número já autorizado), sem `chave_acesso`, sem XML, sem DANFE, sem protocolo, sem `focus_ref`, sem status terminal, sem `order_id` (não dispara trigger fiscal nem efeitos colaterais em estoque/financeiro/remessa/e-mail/automação/marketplace).
    - Campos pré-preenchidos no diálogo: natureza da operação, destinatário (nome, CPF/CNPJ, e-mail, telefone, endereço completo), itens (código, descrição, NCM, CFOP, unidade, quantidade, valor unitário, origem, CSOSN, desconto e frete por item), **totais e ajustes financeiros** (desconto total, frete, seguro, outras despesas, modalidade de frete, transportadora, peso bruto/líquido, volumes, forma de pagamento, observações ao Fisco), observações com sufixo de auditoria. Campos fiscais terminais (chave, XML, DANFE, protocolo, focus_ref, eventos, recibos, cancelamentos, CC-e, inutilização, autorização) **nunca** são copiados.
    - Auditoria: `observacoes` recebe sufixo `Duplicado de pedido de venda|NF SERIE-NUMERO.` e o evento `created` é registrado em `fiscal_invoice_events`.
    - Toast de sucesso: "Pedido de venda duplicado com sucesso." (quando duplica Pedido de Venda) ou **"NF duplicada e preparada na aba Notas Fiscais."** (quando duplica NF autorizada/cancelada/rejeitada).
    - **Não impacta o módulo normal de Pedidos da loja** (`/orders`): a duplicação é exclusivamente fiscal e não cria/altera registros em `orders` nem `order_items`.
    - RBAC/multi-tenant: tenant resolvido server-side via `current_tenant_id` do JWT; isolamento entre tenants garantido.

    **Regra oficial de cálculo de totais (v2026-05-16 — Onda 2 rev2)**: O total final do Pedido de Venda (e do invoice manual em geral) é sempre:

    `total = soma(itens) − desconto + frete + seguro + outras despesas` (nunca negativo)

    Regras complementares:
    - Campos vazios contam como zero.
    - Desconto nunca pode tornar o total negativo (o backend aplica `Math.max(0, …)`).
    - O modo "%" no diálogo é apenas conveniência de UI; é convertido em valor monetário antes de salvar.
    - O total **salvo** deve sempre bater com o total **exibido**.
    - O total dos itens é **snapshot** do pedido — preço unitário, quantidade, subtotal, desconto e total de linha são preservados; **nenhum preço é re-buscado do catálogo** ao duplicar.
    - A mesma fórmula é aplicada no frontend (`ManualInvoiceDialog.calculateTotal`) e no backend (`fiscal-create-manual`).

    **Seção "Totais e ajustes" no Pedido de Venda (v2026-05-16 — Onda 2 rev2)**: O diálogo de Pedido de Venda exibe uma seção dedicada com os campos: Desconto (R$ ou %), Frete, Seguro, Outras despesas, Modalidade de frete (Sem frete / CIF / FOB / Terceiros / Próprio remetente / Próprio destinatário) e Observações fiscais (infAdFisco). Esses campos são persistidos em `fiscal_invoices` (`valor_desconto`, `valor_frete`, `valor_seguro`, `valor_outras_despesas`, `modalidade_frete`, `informacoes_fisco`) e usados para compor o `valor_total` segundo a regra oficial acima. O Pedido de Venda permanece um rascunho operacional simples — o formulário completo de NF-e em 6 abas (transportadora detalhada, pagamento múltiplo, ICMS por item, CEST, GTIN editável, peso/volumes) fica para etapa futura.

    **Duplicação preserva o total final (v2026-05-16 — Onda 2 rev2)**: Ao duplicar um Pedido de Venda, o sistema copia do registro original todos os campos financeiros estruturados (desconto total, frete, seguro, outras despesas, modalidade de frete, transportadora, peso, volumes, forma de pagamento, observações ao cliente e ao Fisco, desconto/frete por item) e garante que **o duplicado nasça com o mesmo total final do original**, salvo se o usuário alterar algum campo no diálogo. Para pedidos antigos cujo total original não bate com a soma dos itens e não têm desconto estruturado, o sistema **infere o ajuste necessário** no duplicado (desconto adicional quando `subtotal + ajustes > total original`; "outras despesas" adicionais quando `subtotal + ajustes < total original`) — sem alterar o pedido antigo. Pedidos antigos não são modificados em massa: a correção vale para duplicações a partir desta versão.

    **Separação visual Pedido de Venda × Nota Fiscal (v2026-05-17 — Onda 3)**: O Pedido de Venda é **puramente comercial** e a tela esconde todo conteúdo tributário (CFOP de cabeçalho, CFOP por item, Origem, CSOSN, GTIN tributável, CEST por item, card "Totais de Impostos"). Esses dados permanecem nos bastidores — herdados do cadastro do produto — e só aparecem na tela quando o registro vira **Nota Fiscal** (após "Criar Nota Fiscal"). NCM continua visível no Pedido de Venda porque é pré-requisito para a NF e o usuário precisa ver pendências antes de emitir.

    **Numeração com reaproveitamento controlado (v2026-06-09 — Onda 3 rev2, revisa v2026-05-17)**: Cada loja tem dois contadores em `fiscal_settings` — `numero_pedido_atual` e `numero_nfe_atual`. A regra é:
    - **Pedido de Venda (PV):** o próximo número é `max(maior PV vivo + 1)`. PV é um documento interno (não vai à SEFAZ), então o cursor não trava reuso. Se um PV em rascunho puro for excluído (sem NF emitida vinculada, sem objeto logístico despachado e sem pedido pago ativo), o número volta a estar disponível para a próxima criação.
    - **Nota Fiscal (NF):** o próximo número é `max(maior NF local viva + 1, cursor numero_nfe_atual)`. O cursor `numero_nfe_atual` passa a funcionar como **marca alta da SEFAZ**: nunca recua e é incrementado **somente** quando o número é efetivamente queimado lá fora (sucesso, rejeição ou duplicidade na SEFAZ). NF em **rascunho puro** (sem `chave_acesso` e sem nenhum evento de envio/autorização/rejeição/duplicidade) pode ser excluída e o número volta a estar disponível.
    - **NF que tocou a SEFAZ não pode mais ser excluída**: trigger `guard_nf_deletion_when_submitted_to_sefaz` bloqueia o `DELETE` (`NF_ALREADY_SUBMITTED_TO_SEFAZ`). Para descartar, usar Cancelamento ou Inutilização — número permanece queimado.
    - **Auditoria**: tabela `nf_deletion_audit` (espelho de `pv_deletion_audit`) registra número, série, status, cliente, valor e snapshot de itens em toda exclusão de NF.
    - **Antes (v2026-05-17 — Onda 3)**: a regra era estritamente monotônica para ambos os contadores; excluir nunca reaproveitava. A reversão preserva integridade fiscal (SEFAZ continua sendo fonte de verdade externa e a marca alta impede reuso de número queimado) e reduz inutilizações administrativas desnecessárias para gaps de rascunhos puros.
    - Índices únicos parciais em `fiscal_invoices` continuam impedindo colisões mesmo em corridas concorrentes. A numeração da NF segue sendo alocada **apenas** no momento de "Criar Nota Fiscal", totalmente independente da numeração do Pedido.

    **Auto-herança de dados comerciais para o Pedido de Venda (v2026-05-17 — Onda 3)**: Toda criação de Pedido de Venda (manual via `fiscal-create-draft` ou automática via `fiscal-auto-create-drafts`) puxa do pedido comercial:
    - **Transporte**: `modalidade_frete` (SEFAZ) — `0` (CIF, loja envia) quando há endereço de entrega; `9` (Sem ocorrência de transporte) quando não há endereço (retirada). `transportadora_nome` = `orders.shipping_carrier` / `shipping_service_name` / `shipping_method_name`.
    - **Pagamento**: `pagamento_meio` mapeado para o código oficial SEFAZ tPag — Pix → `17`, Boleto → `15`, Cartão de Crédito → `03`, Cartão de Débito → `04`, Dinheiro → `01`, Transferência → `18`, demais → `99`. `pagamento_indicador` = `1` (a prazo) para Cartão de Crédito e Boleto; `0` (à vista) para os demais. `pagamento_valor` = `orders.total`.
    - **Peso bruto/líquido**: soma de `produtos.weight × quantidade` (gramas convertidas para kg).
    - **Volumes**: `1` por padrão (ajustável na emissão da NF).
    - O helper compartilhado `_shared/fiscal-order-mapping.ts` garante que ambos os fluxos (manual e automático) usem exatamente a mesma regra.

    **Fluxo de Preparação e Emissão — modelo Bling, 2 registros (v2026-05-16 — Onda 2 rev3)**:

    **Princípio:** Pedido de Venda e Nota Fiscal são **dois documentos distintos**. O Pedido de Venda é a fonte de verdade operacional e permanece **imutável** após a criação da NF. A Nota Fiscal é um **snapshot fiscal independente**, criado a partir do Pedido, e pode existir em múltiplas instâncias (ex.: devolução, complementar) sem afetar o Pedido original.

    **Etapa 1 — Pedidos de Venda → Criar Nota Fiscal (snapshot, não transmite)**:
    - Na aba **Pedidos de Venda**, o botão/ação principal é **"Criar Nota Fiscal"** (singular ou plural em massa).
    - Ao clicar, o backend executa `fiscal-prepare-invoice`, que detecta `fiscal_stage='pedido_venda'` e:
      1. **Cria um novo registro** em `fiscal_invoices` com `source_order_invoice_id` apontando para o Pedido de origem (clonando todos os campos do destinatário, itens, valores, transporte e fiscais; resetando campos de SEFAZ/Focus/chave/protocolo).
      2. Clona os itens (`fiscal_invoice_items`) para a nova NF.
      3. Executa validação local completa (configurações fiscais, certificado, CNPJ do emitente, destinatário, endereço, itens, NCM, CFOP, valores) **sem chamar Focus/Sefaz** sobre o **novo registro**.
      4. Define `fiscal_stage='pronta_emitir'` (sem erros) ou `fiscal_stage='pendencia'` (com pendências) no **novo registro**.
    - **O Pedido de Venda original permanece intacto** em `fiscal_stage='pedido_venda'` e pode ser usado novamente (gerar segunda NF, devolução, etc.).
    - Em caso de falha na cópia de itens ou no update final, o snapshot é removido automaticamente (rollback) — nenhum lixo é deixado.
    - **Esta ação nunca transmite para a Receita.**
    - **Após criar a NF, o usuário é redirecionado para a aba Notas Fiscais.**

    **Etapa 2 — Notas Fiscais → Emitir Nota Fiscal (transmite)**:
    - Na aba **Notas Fiscais**, registros em `fiscal_stage='pronta_emitir'` exibem a ação **"Emitir Nota Fiscal"** (singular) ou **"Emitir Notas Fiscais (N)"** (plural em massa) — ou **"Emitir NF-e de teste"** em homologação.
    - Ao clicar, abre `AlertDialog` de confirmação obrigatória. Só então chama `fiscal-submit`/`fiscal-emit` que efetivamente transmite para a Focus/SEFAZ.
    - **Ação bloqueada para `fiscal_stage='pendencia'`**: o botão fica desabilitado com tooltip informando que há pendências a resolver.
    - **Ações de emissão NUNCA aparecem na aba Pedidos de Venda nem no editor de Pedido** — somente na aba Notas Fiscais.
    - Após transmissão bem-sucedida, `fiscal_stage` muda para `emitida` e `status` passa a refletir o retorno da SEFAZ.

    **Etapa 3 — Revalidação automática no editor de NF**:
    - Ao abrir um registro de NF em `pendencia` no **InvoiceEditor** e salvar alterações, o backend executa `fiscal-prepare-invoice` no próprio registro (sem criar novo snapshot, pois `fiscal_stage` já não é `pedido_venda`).
    - Se as pendências foram sanadas, atualiza para `pronta_emitir`. Caso contrário, permanece em `pendencia` com a lista atualizada.
    - O editor de NF **não transmite mais** diretamente para a SEFAZ. Dentro do editor, a ação final é apenas de salvamento. A transmissão continua concentrada na lista da aba **Notas Fiscais**, preservando um único ponto de envio operacional.

    **Etapa 4 — Cliente e Produto como fonte de verdade única**:
    - **Atualização 2026-05-18g**: os campos do destinatário (nome, CPF/CNPJ, endereço, telefone, e-mail) no editor de Pedido de Venda e de NF são **editáveis** mesmo quando o registro está vinculado a um cliente cadastrado. Ao salvar, se houver alterações em campos do destinatário, o sistema abre o diálogo de sincronização: (1) salvar pedido e atualizar cadastro do cliente, (2) salvar somente neste pedido, (3) cancelar. Sem essa edição direta, o usuário não consegue corrigir pendências (ex.: cidade com typo) sem sair do fluxo. Os campos fiscais do item (NCM, CFOP, Origem, GTIN) permanecem **somente leitura** quando vinculados a produto cadastrado — esses devem ser corrigidos no cadastro de Produtos.
    - Links **"Abrir cadastro"** continuam disponíveis no cabeçalho da aba para correção mais ampla. O Pedido/NF não duplica dados sensíveis fora do snapshot fiscal — apenas referencia.
    - Alertas por linha de item indicam, em tempo real, NCM/CFOP/Origem/GTIN ausentes ou inválidos, antes mesmo de clicar em "Criar Nota Fiscal".

   **Status `processing` (v2026-05-14)**: Quando o Focus NFe retorna `processando_autorizacao`, a NF-e fica em `processing`. A lista exibe o badge **"Processando SEFAZ"** (Clock) e o menu da linha mostra **"Atualizar Status"** em vez de "Emitir" — assim o usuário não tenta reemitir uma nota que já está aguardando autorização. O webhook (`fiscal-webhook`) e o reconciliador manual (`fiscal-check-status`) já atualizam a coluna `status` para `authorized` ao receber `autorizado` do Focus, gravam chave de acesso, protocolo, XML e DANFE, e respeitam idempotência (não rebaixam status terminal). **Reconciliação manual de divergência local** (status `processing` no banco mas evento `authorized` já persistido em `fiscal_invoice_events` com chave/protocolo válidos): `UPDATE fiscal_invoices` direto na coluna, sem chamar Focus/Sefaz. Caso da NF 1-265 do tenant Respeite o Homem em 2026-05-14 — `authorized` foi gravado como evento mas o webhook não chegou a atualizar o cabeçalho; reconciliado localmente.

   **Declaração de Conteúdo (DC) — documento não fiscal independente (v2026-05-14 rev3)**:

   A Declaração de Conteúdo é um **documento próprio, não fiscal, independente de NF-e e de remessa**. Ela existe exclusivamente na aba **Pedidos de Venda**:

   - **Ação individual**: cada linha de Pedido de Venda exibe a opção **"Declaração de Conteúdo"** no menu de ações.
   - **Ação em massa**: ao selecionar um ou mais Pedidos de Venda, a barra de ações exibe o botão **"Declaração de Conteúdo"**.
   - **Geração**: chama `generateDeclaracaoConteudoPdf` (`src/lib/declaracaoConteudo.ts`) que monta um PDF próprio com remetente (dados do emitente), destinatário, itens declarados, valor total e aviso obrigatório.
   - **Numeração interna**: usa numeração própria no formato `DC-TIMESTAMP-ID` (ex: `DC-12345678-ABCD`), sem conflito com numeração fiscal de NF-e.
   - **Limitações operacionais**: não chama `fiscal-emit`, não chama `fiscal-submit`, não chama Focus/Sefaz, não gera chave de acesso, protocolo, XML ou DANFE de NF-e.
   - **Imutabilidade de stage**: a geração da DC **não altera** o `fiscal_stage` do pedido (permanece em `pedido_venda`).
   - **Escopo**: não aparece na aba Notas Fiscais.

   > **Aviso obrigatório impresso no documento:** "Declaração de Conteúdo não substitui Nota Fiscal quando a emissão de NF-e for obrigatória."

   A função `dce-emit` (Declaração de Conteúdo Eletrônica via Focus NFe) continua existindo no backend como integração futura, mas não é acionável pela UI operacional comum.

5. **NF Autorizada vs Emitida**: "Autorizada" = SEFAZ aprovou e NF foi enviada ao cliente. "Emitida" = NF impressa e preparada para despacho físico.
6. **Terminal**: `completed` é o estado final após confirmação de entrega.
7. **Fallback de CPF/CNPJ no rascunho fiscal (v2026-04-05)**: Na criação do rascunho, o sistema busca o CPF/CNPJ do cliente na seguinte ordem de prioridade: 1) `customers.cpf`; 2) `orders.customer_cpf`; 3) `orders.customer_cnpj`. Se nenhum estiver disponível, o campo é enviado vazio. Esse fallback garante que pedidos cujos clientes foram importados sem documento fiscal ainda tenham o dado preenchido quando informado diretamente no checkout.
8. **Enriquecimento automático de clientes (v2026-04-08)**: O trigger `trg_recalc_customer_on_order` atualiza campos nulos (`cpf`, `phone`, `full_name`) no registro do cliente com dados do pedido aprovado mais recente. Isso garante que clientes importados sem CPF/telefone sejam completados automaticamente quando esses dados estiverem disponíveis no checkout.

### Monitoramento de Risco: Chargeback na Tela Fiscal (v2026-04-08)

| Campo | Valor |
|-------|-------|
| **Tipo** | Melhoria de UX / Segurança Operacional |
| **Localização** | `src/hooks/useFiscal.ts`, `src/components/fiscal/FiscalInvoiceList.tsx` |
| **Descrição** | Rascunhos fiscais vinculados a pedidos com status `chargeback_detected` ou `chargeback_lost` exibem a badge vermelha **"Chargeback em andamento"** na lista fiscal |
| **Objetivo** | Permitir identificação visual de risco operacional antes da emissão da NF-e |
| **Dados** | `order_status` é obtido via join `orders!fiscal_invoices_order_id_fkey(status)` na query fiscal |

### Interface: Abas e Ações (v2026-05-14 — Onda 2 rev1)

| Campo | Valor |
|-------|-------|
| **Tipo** | Estrutura de UI |
| **Localização** | `src/pages/Fiscal.tsx`, `src/components/fiscal/FiscalInvoiceList.tsx`, `src/components/fiscal/ManualInvoiceDialog.tsx` |
| **Descrição** | A página Fiscal possui duas abas principais separadas por `fiscal_stage`. A coluna `fiscal_stage` é a etapa operacional; a coluna `status` é o status oficial da SEFAZ. |

#### Separação `fiscal_stage` vs `status`

| Conceito | Coluna | O que representa |
|----------|--------|----------------|
| Etapa operacional | `fiscal_stage` | Onde o registro está no fluxo interno: `pedido_venda`, `pronta_emitir`, `pendencia`, `emitida` |
| Status fiscal | `status` | Resposta oficial da SEFAZ: `draft`, `pending`, `processing`, `authorized`, `rejected`, `cancelled` |

- `fiscal_stage` é independente de `status`. Um registro pode estar `fiscal_stage='emitida'` com `status='processing'` (aguardando SEFAZ) ou `status='authorized'` (já aprovada).
- `fiscal_stage` é imutável para o usuário em `emitida` (só o backend altera via `fiscal-emit`/`fiscal-submit`/`fiscal-webhook`).

#### Valores de `fiscal_stage`

| Valor | Significado | Onde aparece |
|-------|-------------|--------------|
| `pedido_venda` | Pedido de venda fiscal — ainda não preparado para emissão | Aba Pedidos de Venda |
| `pronta_emitir` | Nota fiscal preparada, validada localmente, pronta para transmissão | Aba Notas Fiscais (badge "Pronta para Emitir") |
| `pendencia` | Nota fiscal com pendências de validação que impedem transmissão | Aba Notas Fiscais (badge "Pendência Identificada") |
| `emitida` | Nota fiscal já transmitida à SEFAZ (processando, autorizada, rejeitada ou cancelada) | Aba Notas Fiscais |

#### Aba "Pedidos de Venda" (`mode=orders`)
- Lista registros com `fiscal_stage='pedido_venda'`.
- **Pedidos de Venda ≠ Pedidos da loja**: este registro é puramente fiscal/rascunho. Não confundir com o módulo `/orders` (vendas reais).
- Botão principal: **"Novo Pedido de Venda"** → abre `ManualInvoiceDialog` em `mode="create"`.
- Ação por linha: **"Criar Nota Fiscal"** → executa `fiscal-prepare-invoice` e move o registro para a aba Notas Fiscais (`pronta_emitir` ou `pendencia`). **Não transmite para a Receita.**
- Ação por linha: **"Duplicar Pedido de Venda"** → abre `ManualInvoiceDialog` em `mode="duplicate"`. O novo registro permanece em `pedido_venda`.
- O formulário é **simplificado**: Cliente + Produtos (descrição, código, unidade, qtd, valor) + Observações. Campos fiscais (NCM, CFOP, CSOSN, Origem, etc.) são preenchidos automaticamente com defaults no backend.

#### Aba "Notas Fiscais" (`mode=invoices`)
- Lista registros com `fiscal_stage IN ('pronta_emitir', 'pendencia', 'emitida')`.
- Badges por `fiscal_stage`/`status`:
  - **Pronta para Emitir** (`pronta_emitir`) — laranja
  - **Pendência Identificada** (`pendencia`) — amarelo
  - **Processando** (`emitida` + `status='processing'`) — amarelo
  - **Autorizada** (`emitida` + `status='authorized'`) — azul
  - **Impressa** (`status='authorized'` + `danfe_printed_at IS NOT NULL`) — verde (substitui o badge "Autorizada"; a coluna Status mostra **1 pílula por linha — estado mais recente vence**, ver Regra Anti-Regressão #11)
  - **Rejeitada** (`emitida` + `status='rejected'`) — vermelho
  - **Cancelada** (`emitida` + `status='cancelled'`) — vermelho
  - **Erro** (`status='error'`) — vermelho
- Botão principal: **"Nova NF-e"** → abre o **InvoiceEditor em branco apenas em memória, SEM criar registro no banco**. Nenhuma linha aparece na lista até o primeiro **Salvar**. O editor abre em **modo NF Fiscal** (`isPedidoVenda=false`), título provisório "Série 0 – Nº 0" até persistir, sem destinatário pré-preenchido, sem item mockado e sem painéis de pendência/avisos pré-renderizados. Usuário escolhe natureza, destinatário e produto (via "Buscar produto"). **Persistência tardia:** no primeiro Salvar, `handleSaveInvoice` chama `fiscal-create-manual` com `mode='nfe_manual'` para alocar a linha (número/série atribuídos) e em seguida `fiscal-update-draft` aplica os dados do formulário; a partir daí o `id` fica refletido no estado do editor para Salvar/Emitir/Excluir subsequentes. Se o usuário fechar sem salvar, **nada fica no banco**. Validações fiscais só disparam ao Salvar/Emitir, classificando para `pronta_emitir` ou `pendencia`. Este fluxo é **distinto** da criação manual de Pedido de Venda (aba Pedidos de Venda → "Novo Pedido de Venda" → `ManualInvoiceDialog` → `mode='pedido_venda'`). Ver memória anti-regressão `fiscal-manual-nf-vs-pedido-venda-separation` e `fiscal-nfe-manual-no-draft-until-save`.
- Ação por linha (`pronta_emitir`): **"Emitir Nota Fiscal"** (homologação: **"Emitir NF-e de teste"**) → modal de confirmação obrigatória → `fiscal-submit`/`fiscal-emit`. **Esta é a única ação que transmite.**
- Ação por linha (`pendencia`): **"Editar e revalidar"** → abre editor. Ao salvar, `fiscal-prepare-invoice` revalida automaticamente.
- Ação por linha (`emitida` autorizada/cancelada/rejeitada): **"Duplicar NF"** → abre diálogo pré-preenchido. Ao salvar, `fiscal-prepare-invoice` valida e coloca em `pronta_emitir` ou `pendencia` na aba Notas Fiscais. **Nunca volta para Pedidos de Venda.**
- ~~Botão "NF-e de Entrada"~~ removido (rev3) — o tipo de NF é selecionado dentro do InvoiceEditor na aba Geral
- ~~Dropdown "Ações"~~ removido (rev2) — era desnecessário
- ~~"Consultar por Chave"~~ removido como ação separada — o campo de busca da lista já pesquisa por `chave_acesso`

##### Ações em massa

Quando o usuário seleciona uma ou mais NF-e/rascunhos, a barra de ações em massa exibe:

**Aba Pedidos de Venda (`fiscal_stage='pedido_villa'`):**
- **"Criar Nota Fiscal"** (1 selecionado) / **"Criar Notas Fiscais (N)"** (2 ou mais) — executa `fiscal-prepare-invoice` em lote. Após conclusão, o usuário é redirecionado automaticamente para a aba **Notas Fiscais**.
- **"Declaração de Conteúdo"** (individual e em massa) — gera PDF próprio, não fiscal, sem chamar Focus/Sefaz. Não altera `fiscal_stage`.

**Aba Notas Fiscais:**
- **"Emitir Nota Fiscal"** (1 selecionada) / **"Emitir Notas Fiscais (N)"** (2 ou mais) — para itens em `pronta_emitir`. Só disponível quando todos os selecionados estão em `pronta_emitir`. Exige confirmação explícita. Mostra resumo real: X emitidas, Y bloqueadas, Z com erro.
- **"Enviar à transportadora"** — visível quando os itens selecionados são NF-e **autorizadas** com transportadora `kind = 'gateway'` (ex.: Frenet). Dispara `gateway-attach-fiscal-doc`.

> Para pedidos com transportadora `kind = 'local'` (Correios), o despacho continua sendo feito pela tela de **Remessas** (`/shipping/shipments`), com emissão de etiqueta interna. Não há ação de "Enviar à transportadora" no Fiscal nesse cenário.


#### InvoiceEditor — Seletor de Tipo de NF (rev3)
- Campo **"Tipo de Nota"** na aba Geral com opções: Saída (Venda), Entrada (Compra), Devolução, Remessa, Transferência
- Quando tipo = Entrada ou Devolução, exibe campo **"Chave de Acesso da NF-e Referenciada"** (44 dígitos)
- Substitui a necessidade do `EntryInvoiceDialog` como botão avulso

#### InvoiceEditor — Natureza de Operação Dinâmica (rev4)
- Campo **"Natureza da Operação"** carrega opções da tabela `fiscal_operation_natures` filtrada por tenant e status ativo
- Naturezas são **filtradas automaticamente** conforme o tipo de nota selecionado:
  - **Saída** → `tipo_documento=1` + `finalidade=1` (vendas)
  - **Entrada** → `tipo_documento=0` + `finalidade=1` (compras)
  - **Devolução** → `finalidade=4`
  - **Remessa** → critério oficial Receita Federal: **qualquer natureza com CFOP intra na faixa 5900–5999** (independentemente de `faturada`). Cobre armazém geral, demonstração, consignação, bonificação, amostra grátis, conserto, comodato, industrialização, exposição/feira, vasilhame, conta e ordem etc.
  - **Transferência** → naturezas cujo nome contém "transferência"
- Ao selecionar uma natureza, os seguintes campos são preenchidos automaticamente: **CFOP** (`cfop_intra`), **Indicador de Presença** (`ind_pres`), **Consumidor Final** (`consumidor_final`)
- Ao trocar o tipo de nota, natureza e CFOP são **resetados** para forçar re-seleção coerente
- CFOP preenchido usa `cfop_intra` como padrão (intraestadual); o usuário pode alterar manualmente para `cfop_inter` se necessário
- **Catálogo padrão por tenant: 33 naturezas** cobrindo todas as operações comuns de e-commerce + a faixa completa 5.900/6.900 da Receita Federal (Outras Saídas), incluindo:
  - Vendas (5101/6101, 5102/6102)
  - Compras (1102/2102, 1556/2556)
  - Devoluções (1202/2202, 5202/6202)
  - Transferência (5152/6152)
  - **Remessas (faixa 5.900):** Industrialização por encomenda (5901/5902/5903), Venda fora do estabelecimento (5904), **Armazém Geral / Depósito Fechado (5905/5906/5907)**, Comodato (5908/5909), Bonificação (5910), Amostra Grátis (5911), Demonstração (5912/5913/1913), Exposição/Feira (5914), Conserto (5915/5916), Consignação (5917/5918), Vasilhame/Sacaria (5920/5921), Entrega Futura (5922), Conta e Ordem de Terceiros (5923), Industrialização por Conta e Ordem (5924), Outras saídas (5949)
- Seed automático no primeiro acesso via `OperationNaturesSettings.tsx`

#### ManualInvoiceDialog (simplificado para pedidos)
- **Título**: "Novo Pedido"
- **Campos do formulário**: Cliente (busca ou manual) + Produtos (código, descrição, unidade, qtd, valor unitário) + Observações
- **Sem campos fiscais** — NCM, CFOP, CSOSN, Origem, Natureza da Operação, Indicadores SEFAZ e Pagamento são gerenciados apenas no InvoiceEditor

#### Regra obrigatória: Produto sempre vem completo do cadastro (v2026-05-16 — Onda 2 rev3)
- **Itens só podem ser adicionados via busca no catálogo.** O botão de "adicionar item manualmente / em branco" foi removido tanto do `ManualInvoiceDialog` (Pedido de Venda) quanto do `InvoiceEditor` (NF). O usuário não preenche campos de produto à mão — ele seleciona um produto cadastrado e, se precisar, edita os campos editáveis depois.
- Ao selecionar um produto pelo `ProductSelector`, o sistema puxa do cadastro: **peso (gramas)**, **NCM**, **CFOP**, **unidade**, **origem**, **GTIN**, **CEST** e **preço**. Esses valores entram automaticamente no item; campos fiscais terminais permanecem somente leitura quando o item está vinculado ao produto.
- **Validação de bloqueio na UI:** se o produto selecionado estiver sem **peso** ou sem **NCM** cadastrado, o sistema **não adiciona** o item e exibe aviso em português claro orientando o usuário a completar a ficha do produto antes de tentar novamente. A mensagem identifica o produto pelo nome e indica o campo faltante. Vale para Pedido de Venda e NF.
- **Motivo:** peso é obrigatório para Declaração de Conteúdo dos Correios e Remessas; NCM é obrigatório para emissão fiscal. Forçar o preenchimento na origem (cadastro do produto) elimina pedidos/NFs nascidos quebrados e a necessidade de re-trabalho na hora de emitir DC ou NF-e.
- **Mensagens de erro pós-ação (ex.: gerar Declaração de Conteúdo):** o backend pode devolver `weight_required` quando algum item antigo do pedido foi gravado sem peso. A UI traduz para "Falta cadastrar o peso de um ou mais produtos. Cadastre o peso na ficha do produto e tente novamente." Nunca exibir o código técnico ao usuário.

#### Busca de Cliente no ManualInvoiceDialog
- Seletor com duas opções: **"Cliente existente"** e **"Preencher manualmente"**
- **Cliente existente**: campo de busca com debounce (400ms) que consulta `customers` por `full_name` (ilike), `email` (ilike) e `cpf` (ilike nos dígitos). Inclui join com `customer_addresses` para endereço. Filtro `deleted_at IS NULL`. Limite de 10 resultados. Dropdown de resultados aparece imediatamente ao digitar. Ao selecionar, preenche automaticamente todos os campos do destinatário (nome, CPF/CNPJ, email, telefone, endereço padrão ou primeiro disponível).
- **Preencher manualmente**: campos vazios para digitação livre.

#### Mapeamento de Campos (customers → ManualInvoiceDialog)
| Campo DB (`customers`) | Campo DB (`customer_addresses`) | Campo UI |
|---|---|---|
| `full_name` | — | Nome / Razão Social |
| `cpf` | — | CPF / CNPJ |
| `email` | — | E-mail |
| `phone` | — | Telefone |
| — | `street` | Logradouro |
| — | `number` | Número |
| — | `complement` | Complemento |
| — | `neighborhood` | Bairro |
| — | `city` | Município |
| — | `state` | UF |
| — | `postal_code` | CEP |

#### Regras Anti-Regressão do Fluxo Fiscal (v2026-05-14 — Onda 2 rev2)

1. **Nunca juntar "criar nota" com "emitir"**: a ação "Criar Nota Fiscal" em Pedidos de Venda prepara e valida localmente; a transmissão só acontece via "Emitir Nota Fiscal" em Notas Fiscais.
2. **Não renomear botão se o comportamento não corresponder**: um botão chamado "Emitir" ou "Criar Nota Fiscal" deve ter o comportamento documentado nesta seção.
3. **Pedido de Venda nunca transmite direto para Receita/SEFAZ**: um registro em `fiscal_stage='pedido_venda'` só pode sair dessa etapa via `fiscal-prepare-invoice`.
4. **NF duplicada nunca volta para Pedidos de Venda**: ao duplicar uma NF autorizada/cancelada/rejeitada, o novo registro entra em `pronta_emitir` ou `pendencia` na aba Notas Fiscais.
5. **Não permitir envio de nota com Pendência Identificada**: o botão "Emitir Nota Fiscal" fica desabilitado para `fiscal_stage='pendencia'`; o usuário deve editar, salvar e aguardar revalidação automática.
6. **Declaração de Conteúdo não é NF-e**: a DC é documento próprio, não fiscal, independente. Ela não substitui NF-e quando a emissão for obrigatória.
7. **Duplicar Pedido de Venda nunca cria NF automaticamente**: a duplicação mantém o registro em `pedido_venda`.
8. **Cancelar NF nunca cria Pedido de Venda nem NF nova**: o cancelamento é ação terminal sobre a nota existente.
9. **Produção real exige confirmação explícita posterior**: o ambiente do tenant Respeite o Homem permanece em homologação até nova autorização. Nenhuma NF real deve ser transmitida em produção sem validação completa.
10. **Não exibir sucesso falso em emissão**: toast de sucesso só aparece após confirmação real da operação. Se a emissão falhar antes de transmitir, não mostrar sucesso.
11. **Status visual da NF: 1 pílula por linha — estado mais recente vence** (v2026-05-21). A coluna Status da lista de Notas Fiscais nunca mostra duas pílulas empilhadas. Quando a NF está autorizada **e** impressa (`danfe_printed_at IS NOT NULL`), exibe apenas **"Impressa"** (verde). Quando autorizada e ainda não impressa, exibe **"Autorizada"** (azul). Cancelada, rejeitada, pendente Sefaz e devolvida seguem como pílula única. O histórico de impressão continua disponível na timeline da nota — não duplicar pílulas para mostrá-lo na lista.
12. **Impressão de DANFE: 1 aba só.** A abertura do PDF da DANFE acontece **exclusivamente** no `InvoiceActionsDropdown.handlePrintDanfe`. O callback `onPrint` recebido pelo dropdown deve apenas marcar `danfe_printed_at`/`printed_at` no banco e atualizar a lista — nunca chamar `window.open` novamente. Causou regressão "DANFE abre duas vezes" em 2026-05-21. **Rev 2026-05-25:** removido o item redundante **"Baixar DANFE (PDF)"** do menu de ações de nota Autorizada. Imprimir/Reimprimir DANFE já abre o PDF e permite salvar pelo próprio leitor — manter as duas opções confundia o lojista. O menu de Autorizada agora expõe apenas **Reimprimir DANFE**, **Baixar XML**, **Copiar Chave**, **Carta de Correção**, **Duplicar NF**, **Emitir Devolução**, **Ver Histórico**, **Reenviar por Email** e **Cancelar NF-e**.
13. **Feedback visual obrigatório em toda ação fiscal de longa duração** (v2026-05-21 rev2). Tanto **Criar Nota Fiscal** a partir de Pedido de Venda (`fiscal-prepare-invoice`, `kind: 'create'`) quanto **Emitir NF-e** à Receita (`fiscal-submit`, `kind: 'send'`) — individual ou em lote — abrem o `SendingInvoiceModal` no início e fecham no `finally`. O modal é não-dismissível enquanto a operação está em andamento (bloqueia duplo-clique e cliques fora). Em lote, mostra contador "X de Y" e label da NF atual. A pílula "Processando…"/"Pronta para Emitir" na linha permanece como reforço. Proibido executar qualquer das duas chamadas a partir da lista sem disparar o modal.
14. **Filtro padrão da aba Pedidos de Venda = "Em aberto"** (v2026-05-21). Ao montar `FiscalInvoiceList` com `mode='orders'`, o estado inicial de `statusFilter` é `['em_aberto']`. A aba Notas Fiscais (`mode='invoices'`) continua iniciando sem filtro. Justificativa de negócio: ao abrir o módulo Fiscal, o lojista vê primeiro o que precisa de ação, sem precisar filtrar manualmente.
15. **Impressão de DANFE e Etiqueta sempre via visualizador interno** (v2026-06-11). Os botões "Imprimir DANFE" e "Imprimir Etiqueta" abrem **sempre** a rota interna `/imprimir?source={danfe|etiqueta}&id={id}`. O visualizador baixa o PDF pelo backend do próprio sistema e dispara o diálogo de impressão automaticamente. **Proibido** abrir URLs de parceiros (Focus NFe, Correios CWS, Frenet) direto em `window.open` — causa `ERR_BLOCKED_BY_CLIENT` em ambientes com extensões, proxies corporativos (Cloudflare Gateway, Cisco Umbrella, Fortinet), antivírus com filtro web ou DNS de segurança. O erro nunca aparece em log de backend porque o request é bloqueado no browser. **Exceção:** Declaração de Conteúdo gera PDF localmente (jsPDF) e não precisa do visualizador. **Anti-regressão:** ver `mem://constraints/print-via-internal-viewer-no-external-domains`.


---

## Correções de UI/UX e Fluxo — Pós fiscal_stage (v2026-05-14 — Onda 2 rev2)

### Rótulos e singular/plural

| Contexto | 1 selecionado | 2 ou mais |
|----------|---------------|-----------|
| Pedidos de Venda | **Criar Nota Fiscal** | **Criar Notas Fiscais (N)** |
| Notas Fiscais | **Emitir Nota Fiscal** | **Emitir Notas Fiscais (N)** |

O rótulo "Enviar à Receita" foi removido do fluxo comum de Notas Fiscais. A ação de transmissão agora se chama **"Emitir Nota Fiscal"** (ou "Emitir NF-e de teste" em homologação).

### Redirecionamento automático

Após criar nota fiscal a partir de Pedidos de Venda (ação individual ou em massa), o usuário é **redirecionado automaticamente** para a aba **Notas Fiscais** para acompanhar o resultado.

### Cores dos status (badge visual)

| Status / Stage | Cor do badge |
|----------------|--------------|
| Pronta para Emitir (`pronta_emitir`) | laranja |
| Pendência Identificada (`pendencia`) | amarelo |
| Processando SEFAZ / Aguardando protocolo (`processing`) | amarelo |
| Autorizada (`authorized`) | azul |
| Impressa (autorizada + `danfe_printed_at`) | verde (substitui "Autorizada" — 1 pílula por linha) |
| Cancelada (`cancelled`) | vermelho |
| Rejeitada (`rejected`) | vermelho |
| Erro (`error`) | vermelho |

### Correção do falso positivo de CNPJ

Na validação pré-emissão (`runEmitPrecheck`), o CNPJ do emitente e o CNPJ do certificado são **normalizados para apenas dígitos** antes da comparação. Quando os dígitos batem, nenhum aviso de divergência aparece. Quando divergem, a emissão é bloqueada com mensagem clara. O emitente é a empresa da loja, não o cliente/destinatário.

### Emissão em massa e sucesso falso

- Não há toast de sucesso antes da confirmação real da operação.
- Envio em massa mostra resumo real: "X de N emitida(s), Y com erro".
- Se a emissão falhar antes de transmitir (erro de validação, CNPJ divergente, certificado inválido), o sistema **não** mostra sucesso falso.
- Após emissão, a lista é recarregada (`refetch`) para refletir o `fiscal_stage`/`status` atualizado.

---

## Onda 1 — Conformidade mínima Sefaz por item (v2026-05-16)

Escopo: garantir que toda NF-e transmitida atenda aos campos mínimos exigidos por item pela Sefaz, independentemente de regime tributário. Não inclui CST/IPI completos, cartão estruturado nem responsável técnico (reservados para Ondas 2-4).

### Campos por item agora visíveis e persistentes

Cada item do Pedido de Venda e da Nota Fiscal passa a ter:

- **GTIN / Código de barras (cEAN)** — código de barras comercial do produto. Aceita 8, 12, 13 ou 14 dígitos. Quando o produto não tem código de barras, o sistema usa o valor padrão `SEM GTIN` (em letras maiúsculas, sem acento), aceito oficialmente pela Sefaz.
- **GTIN tributável (cEANTrib)** — espelha o GTIN comercial por padrão; pode ser editado quando o produto tributável for diferente.
- **CEST** — Código Especificador da Substituição Tributária, 7 dígitos. Obrigatório quando o produto está sujeito a ST; opcional caso contrário.
- **Desconto por item (R$)** — desconto unitário aplicado àquela linha. A soma dos descontos de itens nunca conta em dobro com o desconto do cabeçalho: o sistema aplica o **maior** entre o desconto do cabeçalho e a soma dos descontos por item.

### Regra do botão "Sem GTIN"

No editor de itens, ao lado do campo GTIN, há o botão **Sem GTIN**. Ao clicar, o sistema preenche GTIN e GTIN tributável com o valor literal `SEM GTIN`. Esse é o único valor aceito pela Sefaz quando o produto não tem código de barras. Não é necessário acionar o botão manualmente: quando o campo fica em branco no momento da emissão, o sistema aplica `SEM GTIN` automaticamente.

### Carga automática a partir do catálogo

- Na criação da NF a partir de um pedido, o sistema lê o GTIN do cadastro do produto (campo canônico `gtin`, com fallback para `barcode`) e o CEST do cadastro fiscal do produto, gravando-os no item da NF.
- Quando o cadastro não tem GTIN, o item nasce com `SEM GTIN` já preenchido.
- Quando o produto não tem CEST configurado, o campo permanece vazio (CEST só é enviado à Sefaz se tiver exatamente 7 dígitos).

### Payload Focus NFe

O payload enviado à Focus NFe agora inclui, por item:

- `codigo_barras_comercial` (cEAN) — sempre presente, com valor real ou `SEM GTIN`.
- `codigo_barras_tributavel` (cEANTrib) — sempre presente, com valor real ou `SEM GTIN`.
- `codigo_cest` — incluído apenas quando o CEST tiver exatamente 7 dígitos.
- `valor_desconto` — desconto efetivo do item, com rateio automático quando o desconto vier do cabeçalho (rateio proporcional ao valor de cada item, ajuste de centavos no último item).

### Totais e duplicação — validação contínua

A correção de totais e duplicação entregue anteriormente continua valendo:

- Total da NF = Soma dos produtos − Desconto efetivo + Frete + Seguro + Outras despesas (nunca negativo).
- Duplicação de Pedido de Venda preserva o valor final original. Quando o pedido antigo não tem desconto/ajuste estruturado, o sistema aplica a regra de inferência (compensa via desconto ou via outras despesas) para que o total do novo rascunho seja exatamente igual ao do pedido original.
- Nenhum preço é buscado do catálogo atual na duplicação: tudo é snapshot dos itens originais.

### Garantias de segurança

- Nenhuma NF é emitida ou transmitida automaticamente nessa etapa: a Onda 1 é só dados, persistência e payload.
- A emissão real continua exigindo confirmação explícita no diálogo (igual ao comportamento anterior).
- A regra de homologação versus produção real continua intacta.

### Como testar pela UI

1. Em **Fiscal → Pedidos de Venda**, abra um pedido existente e clique em **Duplicar Pedido de Venda**. Confirme que o valor final do novo rascunho é exatamente igual ao do original.
2. No editor de itens, confirme que os novos campos GTIN, GTIN tributável, CEST e Desconto aparecem em cada item.
3. Em um item sem código de barras, clique em **Sem GTIN** e salve. Reabra para confirmar que `SEM GTIN` foi preservado.
4. Em um item com CEST de 7 dígitos, salve e reabra para confirmar a preservação.
5. Preencha desconto no cabeçalho e desconto em algum item simultaneamente; confirme que o total da NF aplica o **maior** entre os dois, sem somar em dobro.
6. Crie uma NF a partir de um pedido cujo produto tem GTIN cadastrado em **Produtos**: confirme que o item já nasce com o GTIN preenchido.

---

## 2. Financeiro

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Finance.tsx` | Dashboard financeiro |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Contas a receber | 🟧 Pending | Entradas |
| Contas a pagar | 🟧 Pending | Saídas |
| Fluxo de caixa | 🟧 Pending | Previsão |
| Conciliação | 🟧 Pending | Bancária |
| DRE | 🟧 Pending | Demonstrativo |

### Modelo de Dados
```typescript
// financial_transactions
{
  id: uuid,
  tenant_id: uuid,
  type: 'income' | 'expense',
  category: string,
  description: text,
  amount_cents: int,
  due_date: date,
  paid_date: date,
  status: 'pending' | 'paid' | 'overdue' | 'cancelled',
  reference_type: 'order' | 'purchase' | 'manual',
  reference_id: uuid,
}

// financial_categories
{
  id: uuid,
  tenant_id: uuid,
  name: string,
  type: 'income' | 'expense',
  parent_id: uuid,
}
```

---

## 3. Compras

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Purchases.tsx` | Gestão de compras |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Pedidos de compra | 🟧 Pending | Criação/gestão |
| Fornecedores | 🟧 Pending | Cadastro |
| Cotações | 🟧 Pending | Comparação |
| Entrada de estoque | 🟧 Pending | Recebimento |

### Modelo de Dados
```typescript
// purchase_orders
{
  id: uuid,
  tenant_id: uuid,
  supplier_id: uuid,
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled',
  total_cents: int,
  expected_date: date,
  received_date: date,
  notes: text,
}

// purchase_order_items
{
  id: uuid,
  purchase_order_id: uuid,
  product_id: uuid,
  variant_id: uuid,
  quantity: int,
  unit_cost_cents: int,
  received_quantity: int,
}
```

---

## Integrações ERP

| Sistema | Status | Descrição |
|---------|--------|-----------|
| Bling | 🟧 Coming Soon | Sincronização |
| Tiny | 🟧 Coming Soon | Sincronização |
| Omie | 🟧 Coming Soon | Sincronização |
| ContaAzul | 🟧 Coming Soon | Financeiro |

---

## Sincronia com Pedidos em Regressão (v2026-05-01)

Quando um pedido entra em estado regressivo (`cancelled`, `returned`, `chargeback_detected`, `chargeback_lost`, `payment_expired`, `invoice_cancelled`), o módulo Fiscal reage automaticamente:

- **NF-e em rascunho/pendente:** linhas correspondentes em `fiscal_draft_queue` com status `pending`/`processing` recebem `status = 'cancelled'`, `cancelled_at` e `cancel_reason = 'order_regression:<motivo>'` via trigger `cancel_pending_drafts_on_regression`. Não há emissão.
- **NF-e já autorizada:** o documento **não é cancelado automaticamente** (exige justificativa SEFAZ). É marcado com `requires_action = true` e `action_reason = <motivo>` via trigger `handle_order_fiscal_alert`. Aparece no banner em `OrderDetail` e no card "Notas Fiscais" da Central de Execuções como "NF-e a cancelar (regressão)". O cancelamento é manual via `fiscal-cancel`, que registra log no `order_history` e sinaliza remessas pendentes do mesmo pedido.
- **Reforço idempotente:** a edge function `order-regression-handler` é chamada por `core-orders` e por webhooks/cron; reaplica as marcações acima caso a transição não passe por `core-orders` (ex.: webhook de chargeback direto).

Detalhe completo do pipeline: `docs/especificacoes/ecommerce/pedidos.md` §4.6.

### Cancelamento de NF-e — registro da justificativa (v2026-05-20)

Quando o lojista cancela uma NF-e autorizada, a justificativa informada (15–255 caracteres, exigida pela SEFAZ) é gravada em **dois campos** do registro fiscal:

- `cancel_justificativa`: texto puro digitado pelo usuário (enviado ipsis litteris à SEFAZ).
- `status_motivo`: prefixado com `"Cancelada a pedido do emitente: "` + justificativa. É o campo exibido na UI (detalhe da NF e listagem), garantindo que o histórico mostre o motivo real do cancelamento e não a última mensagem da SEFAZ anterior (ex.: rejeição).

Backfill aplicado em 2026-05-20 para todas as notas `cancelled` que tinham `cancel_justificativa` preenchida mas `status_motivo` ainda apontando para mensagem anterior. Notas legadas canceladas antes do sistema registrar justificativa permanecem sem `status_motivo` (não há como recuperar retroativamente).

Implementação: `supabase/functions/fiscal-cancel/index.ts` faz a atualização atômica dos dois campos junto com `status='cancelled'` e `cancelled_at`.

---

## Tabelas fiscais reais confirmadas (v2026-05-13)

### Existentes e ativas
- `fiscal_dce`
- `fiscal_draft_queue`
- `fiscal_inutilizacoes`
- `fiscal_invoice_cces`
- `fiscal_invoice_events`
- `fiscal_invoice_items`
- `fiscal_invoices`
- `fiscal_operation_natures`
- `fiscal_products`
- `fiscal_settings`

### Referências documentais corrigidas
- `fiscal_certificates` → **inexistente** (erro documental; o certificado fica dentro de `fiscal_settings`)
- `fiscal_event_log` → **inexistente** (erro documental; o registro real fica em `fiscal_invoice_events`)
- `fiscal_numbering_cursors` → **inexistente** (erro documental; o cursor atual fica em `fiscal_settings.numero_nfe_atual`)
- `fiscal_webhook_events` → **inexistente** (erro documental; não há tabela dedicada hoje)

## Pendências

- [x] Migração para Focus NFe (provedor único, produção) — 2026-05-04
- [x] Sincronização de empresa na Focus NFe
- [x] Upload e sincronização automática de certificado A1
- [x] Emissão, cancelamento, CC-e e inutilização via Focus NFe
- [x] Remoção total da Nuvem Fiscal (código, secrets, schema, UI, docs)
- [ ] Dashboard financeiro
- [ ] Módulo de compras
- [ ] Relatórios fiscais
- [ ] Integração com ERPs externos
- [ ] Importação de NF-e de entrada
- [ ] Cancelamento de NF-e
- [ ] Carta de correção (CC-e)

---

## Numeração Fiscal — Arquitetura Anti-Colisão (v8.6.2 — 2026-03-11)

### Problema Original (Causa Raiz)

O campo `numero_nfe_atual` em `fiscal_settings` ficava defasado em relação aos números realmente existentes em `fiscal_invoices`. Quando múltiplos pedidos eram processados, o cursor apontava para um número já utilizado, causando erro `23505` (unique constraint violation) na constraint `fiscal_invoices_numero_unique (tenant_id, serie, numero)`.

**Sintoma:** Pedidos pagos não geravam rascunho de NF-e. A edge function falhava silenciosamente.

### Solução: Shared Module `_shared/fiscal-numbering.ts`

Módulo centralizado usado por **todas** as 3 funções de criação fiscal.

#### Funções

| Função | Descrição |
|--------|-----------|
| `getNextFiscalNumber()` | Consulta `MAX(numero)` diretamente na tabela `fiscal_invoices` para o tenant+série. Retorna `MAX + 1` ou o fallback de `numero_nfe_atual`, o que for maior. **Nunca confia apenas no cursor de settings.** |
| `insertFiscalInvoiceWithRetry()` | Tenta inserir o invoice com o número calculado. Se receber erro `23505` (duplicata de número), incrementa o número e retenta até `maxAttempts` (default: 20). Se o conflito for no índice `idx_fiscal_invoices_order_unique` (mesmo pedido), retorna o invoice existente sem erro. Se o erro NÃO for duplicata, propaga o erro imediatamente. |
| `syncFiscalNumberCursor()` | Após inserção bem-sucedida, recalcula o próximo número via `getNextFiscalNumber()` e atualiza `fiscal_settings.numero_nfe_atual` para manter o cursor sincronizado. |

#### Fluxo de Numeração

```
1. getNextFiscalNumber() → consulta MAX(numero) em fiscal_invoices
   → retorna MAX(maxNumero + 1, fallbackNumeroAtual)

2. insertFiscalInvoiceWithRetry() → tenta INSERT com o número calculado
   ├─ ✅ Sucesso → retorna invoice + numero
   └─ ❌ 23505 (duplicata) → incrementa numero, retenta (até 20x)
       └─ ❌ Outro erro → throw imediato

3. syncFiscalNumberCursor() → recalcula e atualiza fiscal_settings.numero_nfe_atual
```

#### Edge Functions que Usam o Módulo

| Edge Function | Versão | Comportamento |
|--------------|--------|---------------|
| `fiscal-auto-create-drafts` | v8.6.2 | Loop por pedidos pagos sem NF. Usa cursor compartilhado `nextNumeroCursor` que avança a cada invoice criado. Sync final ao terminar. |
| `fiscal-create-draft` | v8.6.2 | Criação individual. Se draft já existe para o pedido, atualiza sem mudar número. Se novo, usa retry. |
| `fiscal-create-manual` | v8.6.2 | NF-e sem pedido vinculado. Mesmo fluxo de retry + sync. |

#### Garantias

1. **Sem dependência exclusiva do cursor**: Sempre consulta `MAX(numero)` no banco antes de inserir.
2. **Race condition safe**: Retry com incremento automático em caso de colisão de número.
3. **Anti-duplicata por pedido**: Índice único parcial `idx_fiscal_invoices_order_unique` impede dois rascunhos ativos para o mesmo pedido. Conflitos são tratados como "já existe".
4. **Cursor auto-reparável**: `syncFiscalNumberCursor` recalcula baseado no estado real do banco.
5. **Idempotente**: `fiscal-auto-create-drafts` verifica existência de invoice antes de criar (double-check).
6. **Single Flow**: Rascunhos são criados exclusivamente via pipeline `Trigger → Fila → Cron`. Webhooks de pagamento não chamam a Edge Function diretamente.

---

## Correções Aplicadas

### fiscal-numbering — Erro 23505 em numeração fiscal (v8.6.2 — 2026-03-11)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug Crítico (Regressão) |
| **Localização** | `supabase/functions/_shared/fiscal-numbering.ts`, `fiscal-auto-create-drafts`, `fiscal-create-draft`, `fiscal-create-manual` |
| **Contexto** | Numeração automática de NF-e ao criar rascunhos |
| **Causa Raiz** | `numero_nfe_atual` em `fiscal_settings` ficava defasado. Tentava inserir número já existente → erro 23505. |
| **Correção** | Criado módulo shared `fiscal-numbering.ts` com: (1) `getNextFiscalNumber` que consulta `MAX(numero)` real, (2) `insertFiscalInvoiceWithRetry` com retry em colisões, (3) `syncFiscalNumberCursor` para manter cursor atualizado. Todas as 3 functions de criação fiscal agora usam esse módulo. |
| **Afeta** | Todo fluxo de criação de NF-e (automático, manual, por pedido) |

### fiscal-auto-create-drafts — Regressão status filter (v8.6.1 — 2026-03-11)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug (Regressão) |
| **Localização** | `supabase/functions/fiscal-auto-create-drafts/index.ts` |
| **Contexto** | Auto-criação de rascunhos de NF-e para pedidos pagos |
| **Descrição** | A function filtrava apenas `status = 'paid'`, mas o novo fluxo fiscal-operacional usa `ready_to_invoice` como status pós-pagamento. Pedidos aprovados não apareciam em "Prontas para Emitir". |
| **Correção** | Alterado para `.eq('payment_status', 'approved').in('status', ['paid', 'ready_to_invoice'])` — garante compatibilidade com fluxo legado e novo. |
| **Afeta** | Módulo Fiscal → aba "Prontas para Emitir", botão "Gerar Rascunhos" |

---

### Padronização de erros — Lote Fiscal (v8.25.0 — 2026-03-29)

| Campo | Valor |
|-------|-------|
| **Tipo** | Padronização de Infraestrutura |
| **Localização** | Todas as 20 edge functions `fiscal-*` + 8 componentes frontend fiscais |
| **Contexto** | Iniciativa global de sanitização de erros para evitar vazamento de dados técnicos |
| **Descrição** | Substituído `error.message` por `errorResponse()` (contrato padronizado) em todas as edge functions fiscais. No frontend, substituído `toast.error(error.message)` por `showErrorToast()` com sanitização automática. |
| **Edge Functions afetadas** | fiscal-emit, fiscal-submit, fiscal-cancel, fiscal-webhook, fiscal-get-status, fiscal-create-draft, fiscal-create-manual, fiscal-validate-order, fiscal-settings, fiscal-upload-certificate, fiscal-send-nfe-email, fiscal-auto-create-drafts, fiscal-sync-focus-nfe, fiscal-test-connection, fiscal-check-status, fiscal-remove-certificate, fiscal-cce, fiscal-inutilizar, fiscal-update-draft, dce-emit |
| **Componentes afetados** | CancelInvoiceDialog, EmitInvoiceButton, CorrectInvoiceDialog, InutilizarNumerosDialog, ManualInvoiceDialog, EntryInvoiceDialog |
| **Afeta** | Módulo Fiscal inteiro — nenhum erro técnico vaza mais para o usuário |

---

## Componentes de Data Padronizados

| Submódulo | Campo | Componente |
|-----------|-------|------------|
| Fiscal | Data da NF-e (InvoiceEditor) | `DatePickerField` |
| Financeiro | Data de lançamento (FinanceEntryFormDialog) | `DatePickerField` |
| Financeiro | Filtro de período (Finance) | `DateRangeFilter` |
| Compras | Data do pedido (PurchaseFormDialog) | `DatePickerField` |
| Compras | Filtro de período (Purchases) | `DateRangeFilter` |

> Ver `regras-gerais.md` § Padrão de Datas para especificação completa.

---

### Sincronização automática Pedido → Fiscal (v2026-04-04)

| Campo | Valor |
|-------|-------|
| **Tipo** | Melhoria Estrutural |
| **Localização** | Trigger `trg_enqueue_fiscal_draft`, `fiscal_draft_queue`, `scheduler-tick` |
| **Contexto** | Rascunhos fiscais eram criados somente quando o usuário acessava o módulo Fiscal (chamada lazy na abertura da tela) |
| **Correção** | (1) Caminho primário: trigger SQL `trg_enqueue_fiscal_draft` captura 100% dos pagamentos aprovados via INSERT atômico em `fiscal_draft_queue`. (2) Processamento: `scheduler-tick` consome a fila a cada minuto chamando `fiscal-auto-create-drafts` com credencial interna. (3) Reconciliação: o mesmo tick também verifica pedidos `ready_to_invoice` sem NF-e como fallback. (4) O job legado direto em pg_cron para essa rotina foi desativado por risco de autenticação pública. Padrão Fila + Cron conforme `automacao-patterns.md`. |
| **Afeta** | Módulo Fiscal → "Prontas para Emitir" já reflete pedidos aprovados sem depender de acesso à tela |

---

## Mapeamento de Campos da NF-e

> Documento de referência completo: [`campos-nfe-referencia.md`](./campos-nfe-referencia.md)

### Campos Obrigatórios e Suas Origens

| Campo | Obrig. SEFAZ | Origem no Sistema | Local de Coleta |
|-------|:---:|-------------------|-----------------|
| GTIN/EAN | S | `products.gtin` | Cadastro de Produto (campo obrigatório) |
| NCM | S | `products.ncm` | Cadastro de Produto / Config Fiscal por Produto |
| CFOP | S | `fiscal_settings.cfop_*` | Configurações Fiscais |
| Origem Fiscal | S | `fiscal_settings.origem_fiscal_padrao` | Configurações Fiscais (select 0-8) |
| CPF/CNPJ Dest. | S | `customers.cpf` / `orders.customer_cpf` | Checkout (campo obrigatório) |
| Endereço Dest. | S | `orders.shipping_address_*` | Checkout (todos campos obrigatórios) |
| Ind. Presença | S | `fiscal_invoices.indicador_presenca` | Editor NF-e (default: 2 = Internet) |
| Ind. IE Dest. | S | `fiscal_invoices.indicador_ie_dest` | Editor NF-e (default: 9 = Não Contribuinte) |
| Pagamento Meio | S | `fiscal_invoices.pagamento_meio` | Derivado do pedido / Editor NF-e |
| CSOSN | S | `fiscal_invoice_items.csosn` | Config Fiscal (default: 102) |
| PIS CST | S | `fiscal_invoice_items.pis_cst` | Config Fiscal (default: 49) |
| COFINS CST | S | `fiscal_invoice_items.cofins_cst` | Config Fiscal (default: 49) |

### Fluxo de Alimentação Automática (Rascunho)

```
Pedido com pagamento aprovado
  ↓ trigger: trg_enqueue_fiscal_draft
  ↓ fila: fiscal_draft_queue
  ↓ processamento: fiscal-auto-create-drafts
  ↓
fiscal_invoices (cabeçalho)
  ├─ Dados do cliente → destinatário
  ├─ Dados do pedido → valores, frete, desconto
  ├─ Config fiscal → serie, ambiente, natureza, cfop
  └─ Defaults → indicador_presenca=2, indicador_ie_dest=9
  ↓
fiscal_invoice_items (itens)
  ├─ Produto → gtin, ncm, cest, descricao
  ├─ Pedido → quantidade, valor_unitario
  ├─ Config fiscal → cfop, origem, csosn
  └─ Defaults → pis_cst=49, cofins_cst=49
```

---

## Protocolo de Troca de CNPJ / Substituição de Certificado A1

**Princípio:** o certificado digital é a fonte de verdade do CNPJ emissor. Cada CNPJ corresponde a uma empresa distinta dentro da Focus NFe (`focus_empresa_id`). Trocar o certificado por um de outro CNPJ é tratado como **troca de empresa emissora**.

### Caminho B — validação delegada ao Focus NFe (rev 2026-05)

Desde a adoção do Caminho B, o sistema **não lê mais o `.pfx` localmente** para extrair CNPJ. O upload empacota arquivo + senha em base64 e envia para o Focus NFe, que devolve a categorização do erro (senha incorreta, CNPJ divergente, formato não suportado, etc.). Veja `mem://constraints/pfx-validation-delegated-to-focus-nfe`.

Como consequência, **não existe mais auto-swap silencioso de CNPJ**: o lojista precisa ajustar os dados do emitente antes de reenviar o certificado de outra empresa.

### Fluxo de upload

1. **Upload de certificado** (`fiscal-upload-certificate`): envia `.pfx` + senha ao Focus NFe.
2. **Focus aceita** → grava `certificado_cn`, `certificado_cnpj`, `certificado_valido_ate`, `certificado_serial` retornados pelo Focus.
3. **Focus rejeita por divergência de CNPJ** ("Certificado não pertence ao CNPJ informado") → resposta amigável devolvida pela edge (`focus-error-translator.ts`).
4. **UI exibe banner vermelho dentro do card "Certificado Digital A1"** com:
   - mensagem clara da divergência;
   - botão **"Atualizar CNPJ do emitente para XX.XXX.XXX/XXXX-XX"** (preenche o campo CNPJ no formulário e pede para o lojista revisar Razão Social / IE / endereço e clicar em Salvar);
   - botão alternativo **"Enviar outro certificado"**.
5. **Após salvar os novos dados**, o lojista reenvia o certificado e o Focus aceita normalmente.

### Remoção de certificado

`fiscal-remove-certificate` limpa também `focus_empresa_id`, `focus_empresa_criada_em` e `focus_ultima_sincronizacao` para evitar vínculo órfão entre cadastros distintos.

### Bloqueio de emissão por divergência

`fiscal-emit` e `fiscal-submit` bloqueiam a emissão (200 OK + `success:false`) sempre que `fiscal_settings.certificado_cnpj` ≠ `fiscal_settings.cnpj`. A nova UI já exibe esse bloqueio antes da tentativa de emissão, no Cartão de Prontidão Fiscal (item "CNPJ do certificado coincide com o do emitente" em vermelho) e no banner do card de certificado.

### Resumo

- Cadastro inicial na Focus NFe é automático no primeiro upload aceito.
- Troca de CNPJ exige ação consciente do lojista: atualizar dados do emitente → reenviar certificado.
- O lojista nunca emite NF-e com vínculo Focus NFe inconsistente.

---

## Padrão de envelope de erro (módulo Fiscal)

Todas as edge functions do módulo fiscal devem retornar **HTTP 200 + `{ success: false, error: "<mensagem clara em PT-BR>" }`** para erros de negócio (senha errada, certificado inválido, CNPJ divergente, validação de dados, recurso não encontrado etc.). Status 4xx/5xx fica reservado para falhas reais de infraestrutura.

Motivo: o cliente do front (`supabase.functions.invoke`) trata respostas ≥400 como erro genérico e a mensagem real não chega ao toast — usuário vê apenas "Erro ao processar fiscal" e o diagnóstico fica impossível.

### Validação do certificado A1 (Caminho B — delegada ao Focus NFe)

Desde rev 2026-05, **toda validação de `.pfx` é delegada ao Focus NFe**. O sistema não abre mais o arquivo localmente — não há mais leitor PKI.js/node-forge ativo no upload nem dependência de cifras suportadas localmente. Razões: cifras modernas (AES-256/PBES2) quebravam o leitor legado e geravam falsos "senha incorreta". Veja `mem://constraints/pfx-validation-delegated-to-focus-nfe`.

Os dois pontos que usam o certificado:
- **Upload/validação** (`fiscal-upload-certificate`): envia base64 + senha ao Focus NFe e armazena o que o Focus devolve (CN, CNPJ, validade, serial).
- **Assinatura do XML** (`_shared/xml-signer.ts → loadCertificate`): segue lendo o `.pfx` armazenado para assinar o XML antes de transmitir. A assinatura em si segue Web Crypto a partir do PEM da chave privada.

### Tradução de erros do Focus NFe

`focus-error-translator.ts` converte as respostas do Focus em mensagens de negócio em PT-BR exibidas no card "Certificado Digital A1":

| Cenário Focus | Mensagem ao usuário |
|---|---|
| Senha incorreta | "Senha do certificado incorreta" |
| CNPJ do certificado ≠ CNPJ do emitente | "O CNPJ do certificado é XX.XXX.XXX/XXXX-XX e o emitente está como YY.YYY.YYY/YYYY-YY. Atualize os dados antes de reenviar." |
| Arquivo não é PFX/PKCS#12 válido | "Arquivo inválido. Reexporte como `.pfx` com senha." |
| Certificado expirado | "Certificado expirado. Solicite a renovação." |
| Demais | mensagem amigável + log técnico para suporte |

Logs de diagnóstico (tamanho, primeiros bytes, resposta bruta do Focus) são gerados em toda chamada para acelerar triagem.

### UI: Configurações Fiscais (rev UX 2026-05)

A tela `/fiscal/configuracoes` (e a aba Fiscal embutida em `/system/settings?tab=fiscal`) foi reorganizada em 5 blocos verticais:

1. **Cartão de Prontidão Fiscal** (topo) — pergunta "Pronto para emitir NF-e?". **Fonte única de readiness** (rev 2026-05-14b): o veredito (selo, título, descrição) e a lista de itens vêm exclusivamente do hook `useFiscalReadiness` (`src/hooks/useFiscalReadiness.ts`), que consome a edge function `fiscal-integration-validate`. **É proibido manter checklist paralelo no frontend.** O card superior e o card "Validação Fiscal" consomem o mesmo `queryKey` (`FISCAL_READINESS_QUERY_KEY`), garantindo que nunca haja contradição entre eles. Estados em linguagem de negócio: `Verificando`, `Configuração pendente`, `Pronto para teste` (homologação), `Pronto para emitir NF-e` (produção), `Configuração com erro`, `Produção bloqueada`. Cada item da lista tem botão "Ir para" que ancora no cartão correspondente (Identidade, Certificado, Validação Fiscal ou Ambiente).
2. **Identidade da Empresa** — Dados + Endereço lado a lado em um único cartão, com seção adicional **"Contato do emitente"** abaixo contendo:
   - **E-mail do emitente** (`fiscal_settings.email`, opcional, validado em formato): a Focus NFe usa este endereço como remetente do DANFE enviado automaticamente ao cliente. Sem ele, o e-mail automático não sai. Recomendado preencher.
   - **Telefone do emitente** (`fiscal_settings.telefone`, opcional, máscara `(11) 99999-9999`): aparece impresso no DANFE.
   Ambos os campos são enviados para a Focus NFe na próxima sincronização (`PUT /v2/empresas/{id}`), via `fiscal-sync-focus-nfe`, e o snapshot pós-sync confirma a persistência do lado do Focus.
3. **Certificado Digital A1** (em destaque, borda colorida conforme estado) — resumo do certificado configurado, banners de divergência/expiração e botão "Substituir certificado" oculto até clique. Quando há divergência de CNPJ, oferece botão "Atualizar CNPJ do emitente para XX.XXX.XXX/XXXX-XX" que preenche o campo automaticamente.
4. **Parâmetros Fiscais** — Regime, Origem, CFOPs, CSOSN/CST, Série/Número.
5. **Ambiente de Emissão** — seletor com aviso destacado quando em Homologação.

A barra de **Salvar** é fixa no rodapé, aparece apenas quando há alterações não salvas e tem botões "Descartar" e "Salvar alterações". A validação local bloqueia salvamento com Razão Social vazia, CNPJ inválido, IE faltante (quando não é Isento) ou e-mail do emitente em formato inválido. O backend só confirma sucesso depois de reler a configuração e validar que o contato do emitente ficou realmente persistido; se houver divergência, retorna erro explícito em vez de sucesso falso.

---

## Lote 1.B — Auditoria e hardening RLS (2026-05-13)

Auditoria de isolamento multi-tenant das 10 tabelas fiscais confirmadas. **Nenhuma NF real foi transmitida ao Focus NFe/Sefaz nesta etapa.**

### Problemas encontrados

1. **Vazamento potencial entre tenants via `profiles.current_tenant_id`** — várias políticas confiavam no campo "tenant atual" do perfil, que o próprio usuário pode atualizar para qualquer UUID (sem validação de vínculo). Risco: um usuário malicioso definia `current_tenant_id` para o ID de outro tenant e lia dados fiscais alheios. Tabelas afetadas: `fiscal_invoices`, `fiscal_invoice_items`, `fiscal_invoice_events`, `fiscal_dce`, `fiscal_products`.
2. **Exposição de segredos fiscais ao frontend** — `fiscal_settings` permitia que qualquer membro do tenant lesse, via select direto, o certificado A1 (PFX), a senha do certificado e o token Focus NFe.

### Correções aplicadas

| Tabela | RLS | Política aplicada | Isolamento |
|---|---|---|---|
| `fiscal_settings` | ✅ | SELECT só para owner/admin; SELECT direto das colunas `certificado_pfx`, `certificado_senha`, `provider_token` revogado de `anon`/`authenticated` | tenant_id direto + papel |
| `fiscal_invoices` | ✅ | SELECT/INSERT/UPDATE para membros do tenant; **DELETE para owner/admin quando `status IN ('draft','rejected','cancelled')`** (notas sem efeito fiscal). DELETE bloqueado para `authorized`, `processing` e qualquer outro status com efeito fiscal — usar Cancelar NF-e. | tenant_id direto via `user_belongs_to_tenant` |
| `fiscal_invoice_items` | ✅ | SELECT/ALL via parent (`fiscal_invoices`) | parent + `user_belongs_to_tenant` |
| `fiscal_invoice_events` | ✅ | SELECT/INSERT por membros do tenant | tenant_id direto via `user_belongs_to_tenant` |
| `fiscal_invoice_cces` | ✅ | SELECT/INSERT por membros do tenant (mantido) | tenant_id direto via `user_roles` |
| `fiscal_inutilizacoes` | ✅ | SELECT/INSERT por membros do tenant (mantido) | tenant_id direto via `user_roles` |
| `fiscal_dce` | ✅ | SELECT/INSERT/UPDATE por membros; DELETE só rascunho | tenant_id direto via `user_belongs_to_tenant` |
| `fiscal_operation_natures` | ✅ | SELECT/INSERT/UPDATE/DELETE por membros (DELETE bloqueia naturezas de sistema) | tenant_id direto via `user_roles` |
| `fiscal_products` | ✅ | SELECT/ALL por membros do tenant | tenant_id direto via `user_belongs_to_tenant` |
| `fiscal_draft_queue` | ✅ | ALL apenas para owner/admin do tenant; rotina interna usa `service_role` (bypass) | tenant_id direto via `user_roles` |

### Exposição de dados sensíveis — após hardening

- **Certificado A1 (PFX)**, **senha do certificado** e **token Focus NFe**: não acessíveis via API REST/PostgREST. Apenas funções internas (service_role) leem. Frontend recebe somente metadados seguros (CN, CNPJ, validade, serial) via edge function `fiscal-settings`, que já mascara/remove o conteúdo.
- **XML, DANFE, chave de acesso**: protegidos por RLS de `fiscal_invoices` (membros do tenant). Não vazam entre tenants.
- **Eventos, CC-e, inutilização, fila fiscal, DC-e**: protegidos por tenant_id + vínculo real em `user_roles`.

### Platform admin

Nenhuma política fiscal abre acesso global a platform admin nesta etapa. Suporte/admin de plataforma deve usar fluxo administrativo dedicado (service_role) — não há atalho via RLS. Qualquer exceção futura precisa ser declarada explicitamente.

### Testes executados

- Verificação de policies pós-migração: as 10 tabelas têm RLS ativo e políticas no role correto (`authenticated`).
- Verificação de grants de coluna: `certificado_pfx`, `certificado_senha`, `provider_token` sem qualquer permissão para `anon`/`authenticated`/`PUBLIC`.
- Frontend confirmado: nenhum componente faz `from('fiscal_settings')` direto — todo acesso passa pela edge function `fiscal-settings`, que continua funcional.
- Rotina interna (`fiscal-auto-create-drafts`, demais edge functions) segue usando `service_role`, mantida.

### Riscos restantes antes de emissão real

- Status `processing/error` ainda não foi padronizado (Lote 1.C).
- 20 edge functions fiscais ainda não passaram por padronização de auth/erros (Lote 1.C).
- Webhook/polling Focus NFe não validado em homologação real.
- Smoke test em homologação não realizado.
- Lints globais (76 itens) fora do escopo fiscal — tratar em onda de segurança transversal.

### Pendências para o Lote 1.C

1. Revisar status `processing/error` e máquina de estados completa de NF-e.
2. Padronizar autenticação e contrato de erro nas 20 edge functions fiscais.
3. Validar webhook Focus NFe em ambiente real.
4. Executar smoke test em homologação.

---

## Lote 1.C.1 — Base técnica das edge functions fiscais críticas (2026-05-13)

### Máquina de status fiscal oficial

`fiscal_invoices.status` (CHECK constraint atualizada):

- **draft** — rascunho criado, não enviado.
- **pending** — aguardando ação do operador (ex.: aguardando correção retornada pela Focus).
- **processing** — enviado e em processamento assíncrono na Focus/Sefaz.
- **authorized** — autorizada pela Sefaz (terminal positivo).
- **rejected** — rejeição da Sefaz (Focus respondeu com erro de autorização ou denegação).
- **cancelled** — cancelada após autorização (terminal).
- **error** — falha técnica não-Sefaz (timeout, parse, rede). Permite reprocessamento.

**`printed` e `devolvido` NÃO são status**. São derivados:
- "Impressa" = `status='authorized'` AND `danfe_printed_at IS NOT NULL`.
- "Devolvida" = existe vínculo via `nfe_referenciada` (NF-e de devolução referencia esta).

Os filtros de UI em `FiscalStatusFilter`/`FiscalInvoiceList` traduzem isso visualmente — não persistem em `status`.

### Mapeamento Focus NFe → status interno (fonte única)

Implementado em `_shared/focus-nfe-adapter.ts::mapFocusStatusToInternal`. O webhook agora importa esta função (sem map duplicado):

| Status Focus | Status interno |
|---|---|
| `processando_autorizacao` | `processing` |
| `aguardando_correcao` | `pending` |
| `autorizado` | `authorized` |
| `cancelado` | `cancelled` |
| `erro_autorizacao` | `rejected` |
| `denegado` | `rejected` |
| (default conservador) | `processing` |

### RBAC em Configurações Fiscais

| Role | GET `fiscal-settings` | POST `fiscal-settings` |
|---|---|---|
| owner | payload completo (token mascarado, PFX/senha removidos) | permitido |
| admin | payload completo (token mascarado, PFX/senha removidos) | permitido |
| operator/support/finance/viewer | payload mínimo: `is_configured`, `ambiente`, `provider`, `razao_social` | bloqueado (`success:false`, `code: FORBIDDEN_ROLE`) |

Operator nunca recebe: PFX, senha, token Focus, série, próximo número, CNAE, CSOSN, CST, endereço completo, CFOPs, regime tributário, dados de empresa Focus, automações fiscais.

### Idempotência do webhook Focus

Se a nota já está em status terminal (`authorized`, `cancelled`, `rejected`) e o webhook recebido reflete o mesmo status, o webhook executa **noop**:
- não atualiza a nota,
- registra evento `webhook_<status>_noop`,
- retorna `200 { success:true, noop:true }`.

Isolamento por `focus_ref` (chave única da nota na Focus) e escopo via `invoice.tenant_id` recuperado da própria nota. Webhook nunca atualiza nota de outro tenant.

### Contrato padrão das edge functions fiscais

- CORS em OPTIONS, sucesso e erro.
- Erro de negócio → HTTP 200 + `{ success:false, error, code? }`.
- Erro técnico → HTTP 5xx via `errorResponse` com log.
- Autenticação: `Authorization: Bearer <jwt>` validado via `auth.getUser`; sem auth → 401.
- Tenant: lido de `profiles.current_tenant_id` e validado em todas as queries de dados via `.eq('tenant_id', tenantId)`.
- Rotinas internas (cron/trigger) usam `service_role` via `scheduler-tick` (Lote 1.A).

### Funções críticas auditadas (sem transmissão Focus/Sefaz)

| Função | CORS | Auth | Tenant | Envelope | Idempotência | Persistência | Observações |
|---|---|---|---|---|---|---|---|
| `fiscal-settings` | ✅ | ✅ | ✅ | ✅ | n/a | ✅ contato confirmado | RBAC owner/admin vs operator aplicado |
| `fiscal-create-draft` | ✅ | ✅ | ✅ | ✅ | numeração via `getNextFiscalNumber` + `insertFiscalInvoiceWithRetry` | ✅ | sem alteração nesta etapa |
| `fiscal-create-manual` | ✅ | ✅ | ✅ | ✅ (Lote 1.A) | ✅ rollback se itens falham (`MANUAL_INVOICE_ITEMS_PERSISTENCE_FAILED`) | ✅ | preserva correção do Lote 1.A |
| `fiscal-update-draft` | ✅ | ✅ | ✅ (verifica `tenant_id` + `status='draft'`) | ✅ | n/a | ✅ | usa `ANON_KEY`+JWT do usuário (RLS) — pendência menor |
| `fiscal-auto-create-drafts` | ✅ | ✅ service_role | ✅ por iteração | ✅ | ✅ checa NF ativa antes (Lote 1.A) | ✅ | bloqueia anon/publishable (Lote 1.A) |
| `fiscal-validate-order` | ✅ | ✅ | ✅ | ✅ | n/a (read-only) | n/a | exclui `cancelled,rejected` (Lote 1.A) |
| `fiscal-emit` | ✅ | ✅ | ✅ | ✅ | check `status in (draft, rejected)` | ✅ | **não executado contra Focus nesta etapa** |
| `fiscal-submit` | ✅ | ✅ | ✅ | ✅ | check `status in (draft, rejected)` | ✅ | **não executado contra Focus nesta etapa** |
| `fiscal-check-status` | ✅ | ✅ | ✅ | ✅ | atualiza apenas se status mudou | ✅ | **não executado contra Focus nesta etapa** |
| `fiscal-get-status` | ✅ | ✅ | ✅ | ✅ | read-only | n/a | **não executado contra Focus nesta etapa** |
| `fiscal-cancel` | ✅ | ✅ | ✅ | ✅ | check `status='authorized'` | ✅ | **não executado** |
| `fiscal-webhook` | ✅ | n/a (público p/ Focus) | ✅ via `invoice.tenant_id` | ✅ | ✅ noop em status terminal igual | ✅ | mapa unificado importado do shared |

### Funções fiscais menos críticas (auditoria superficial)

`fiscal-send-nfe-email`, `fiscal-cce`, `fiscal-inutilizar`, `dce-emit`, `gateway-attach-fiscal-doc`: auditadas, sem alteração nesta etapa. Nenhum bug crítico de segurança ou falso sucesso identificado para correção imediata. CC-e e inutilização ainda chamam Focus diretamente — listadas para padronização no próximo sublote.

### Testes executados (sem transmissão real)

| Teste | Resultado |
|---|---|
| Webhook sem auth, ref inexistente | ✅ 200 + `{success:true, warning:"Invoice not found"}` (não vaza, não cria) |
| `fiscal-settings` GET como owner | ✅ payload completo, `role_view:"full"`, PFX/senha=null, token mascarado |
| `fiscal-settings` GET como operator (revisão de código) | ✅ payload mínimo (4 campos), `role_view:"minimal"` — sem segredos nem campos sensíveis |
| `fiscal-settings` POST como operator (revisão de código) | ✅ bloqueio com `code: FORBIDDEN_ROLE` |
| CHECK constraint aceita `processing`/`error` | ✅ migration aplicada |
| Webhook idempotente em status terminal | ✅ noop por construção; verificado no código |
| Isolamento tenant A → tenant B | ✅ herdado do Lote 1.B (não regrediu) |

### Confirmação de não-transmissão

Nenhuma chamada real foi feita a `api.focusnfe.com.br` nem `homologacao.focusnfe.com.br`. Nenhuma NF real foi transmitida nesta etapa. `fiscal-emit`, `fiscal-submit`, `fiscal-cancel`, `fiscal-cce`, `fiscal-inutilizar` e `fiscal-check-status` foram revisados em código apenas.

### Riscos restantes

- Webhook Focus aceita qualquer chamador. **Falta validação de origem/segredo** (header secreto ou IP allowlist) — pendência crítica para Lote 1.C.2.
- `fiscal-update-draft` usa `ANON_KEY` (RLS) em vez de `service_role + tenant guard` como o restante. Funciona, mas é inconsistente. Padronizar no Lote 1.C.2.
- Smoke test em homologação ainda pendente.
- Funções menos críticas (`fiscal-cce`, `fiscal-inutilizar`, `dce-emit`) ainda não foram padronizadas no envelope/RBAC.

### Pendências para o Lote 1.C.2

1. Validar e endurecer webhook Focus (segredo + idempotência por payload duplicado).
2. Padronizar `fiscal-update-draft` para o padrão `service_role + tenant guard`.
3. Padronizar `fiscal-cce`, `fiscal-inutilizar`, `dce-emit`, `gateway-attach-fiscal-doc`, `fiscal-send-nfe-email`.
4. Smoke test fim-a-fim em homologação Focus NFe (rascunho → submit → webhook → authorized).
5. Avaliar guard adicional para `fiscal-emit/submit` exigir role `owner|admin|finance` (decisão de produto).

---

## Lote 1.C.2 — Hardening de webhook, draft e RBAC de emissão (EXECUÇÃO CONTROLADA)

**Data:** 2026-05-13  
**Modo:** EXECUÇÃO CONTROLADA  
**Escopo:** segurança do webhook Focus, padronização do `fiscal-update-draft`, RBAC nas funções de emissão real, contrato dos auxiliares.  
**Restrições aplicadas:** sem smoke test, sem emissão real, sem chamada à Focus/Sefaz, sem alterar certificado, sem alterar regra de negócio.

### Mudanças aplicadas

**1. Segredo de webhook Focus NFe**
- Adicionada secret `FOCUS_NFE_WEBHOOK_SECRET` (runtime) — valor único, longo, gerado fora do agente.
- `fiscal-webhook` valida o segredo no início do handler:
  - aceita via header `X-Webhook-Secret` (ou `X-Focus-Webhook-Secret`),
  - via query `?secret=...`,
  - via HTTP Basic auth (password).
- Comportamento: **fail-closed** quando o segredo está configurado. Se o segredo não estiver definido, segue passando com warning explícito no log (compatibilidade até registrar a mesma string no painel Focus).

**2. Helper compartilhado de RBAC fiscal**
- Novo `_shared/fiscal-role-check.ts` com:
  - `requireFiscalRole(req, allowedRoles)` — autentica o usuário, resolve `current_tenant_id`, valida o papel em `user_roles` para o tenant atual e devolve um cliente service-role.
  - `validateWebhookSecret(req)` — função única e reutilizável de validação do segredo do webhook.

**3. `fiscal-update-draft` padronizado**
- Removido o uso de `ANON_KEY` (RLS implícita).
- Usa `requireFiscalRole(req, ['owner','admin','operator'])`. Roles `member` e `viewer` recebem `403 insufficient_role`.
- Operações seguem com `service_role` após a guarda explícita de tenant + role.

**4. RBAC de emissão real (`fiscal-emit` e `fiscal-submit`)**
- Adicionada checagem inline de `user_roles` para o tenant atual.
- Apenas `owner` e `admin` podem disparar emissão/submissão real à Focus/Sefaz. `operator` é bloqueado com `403 insufficient_role`.
- `viewer`/`member` continuam bloqueados.

**5. `dce-emit` e `gateway-attach-fiscal-doc`**
- Auth gate adicionado: aceita bearer `service_role` (chamadas internas de cron/trigger) **ou** usuário autenticado com papel `owner|admin|operator`.
- Guarda de tenant ownership por pedido: chamadas user-authenticated não podem operar em pedidos de outro tenant (`forbidden_tenant_mismatch`).
- Registradas no `supabase/config.toml` com `verify_jwt = false` (validação em código, padrão atual do projeto para auxiliares com bypass de service-role).

### Confirmação de não-transmissão

Nenhuma chamada real foi feita a `api.focusnfe.com.br` nem `homologacao.focusnfe.com.br` nesta etapa. Nenhuma NF real foi transmitida. Nenhum cancelamento real foi executado. Certificado A1 não foi tocado.

### Riscos restantes

- Smoke test fim-a-fim em homologação ainda **não foi executado** (pendência explícita do Lote 1.C.3).
- A política de fail-open quando `FOCUS_NFE_WEBHOOK_SECRET` está ausente é intencional (compatibilidade), mas deve virar fail-closed assim que a string for cadastrada no painel Focus. Recomendado endurecer no Lote 1.C.3 após confirmação.
- `fiscal-cce`, `fiscal-inutilizar`, `fiscal-cancel` ainda não receberam o mesmo padrão de RBAC inline — devem ser padronizados antes de qualquer cancelamento real.
- Polling/reconciliação Focus (status `processing`/`error`) ainda não tem rotina dedicada validada.

### Checklist antes do smoke test em homologação (Lote 1.C.3)

1. Cadastrar `FOCUS_NFE_WEBHOOK_SECRET` no painel Focus NFe (mesma string registrada na secret).
2. Padronizar `fiscal-cce`, `fiscal-inutilizar`, `fiscal-cancel` com RBAC `owner|admin`.
3. Confirmar mapa de status (rascunho → processando → autorizado/rejeitado/erro) e rotina de polling/reconciliação.
4. Validar idempotência por `focus_ref` em chamadas duplicadas reais (não apenas por status terminal).
5. Confirmar tenant Respeite o Homem em homologação (não produção) e congelar emissão real até validação.

---

## Lote 1.C.3 — Padronização de cancelamento, CC-e, inutilização e polling (EXECUÇÃO CONTROLADA)

**Data:** 2026-05-13  
**Modo:** EXECUÇÃO CONTROLADA  
**Escopo:** padronização de `fiscal-cancel`, `fiscal-cce`, `fiscal-inutilizar`; polling/reconciliação; idempotência por `focus_ref`; checklist final pré-smoke test em homologação.  
**Restrições:** sem smoke test, sem emissão real, sem cancelamento real, sem CC-e real, sem inutilização real, sem chamada à Focus/Sefaz.

### Mudanças aplicadas

**1. `fiscal-cancel` padronizado**
- Usa `requireFiscalRole(req, ['owner','admin'])`. `operator`/`member`/`viewer` recebem `403 insufficient_role`.
- Tenant guard duplo: select e update filtram por `tenant_id`.
- Idempotência: nota já em `cancelled` retorna `200 + { success: true, noop: true }` sem nova chamada à Focus.
- Validação de status: apenas `authorized` é cancelável; demais retornam `200 + { success: false, code: 'invalid_status' }`.
- Envelope unificado: erros de negócio sempre `200 OK + { success:false, error, code }`.
- Cobra crédito apenas após cancelamento confirmado pela Focus.

**2. `fiscal-cce` padronizado**
- Usa `requireFiscalRole(req, ['owner','admin'])`. `operator` bloqueado.
- Tenant guard em select e na contagem de CC-es existentes.
- Validação de NF autorizada e do limite Sefaz de 20 CC-es.
- Persiste resultado em `fiscal_invoice_cces` e evento em `fiscal_invoice_events` antes de retornar.
- Sem falso sucesso: rejeição da Focus retorna `success:false` com `code: 'focus_error'`.

**3. `fiscal-inutilizar` padronizado**
- Usa `requireFiscalRole(req, ['owner','admin'])`. `operator` bloqueado.
- Validação rígida de `serie`, `numero_inicial`, `numero_final` (inteiros positivos, `inicial <= final`) e `justificativa` (15–255).
- Idempotência por faixa: se já existe inutilização `authorized` para `(tenant_id, serie, numero_inicial, numero_final)`, retorna `noop`.
- Persiste resultado em `fiscal_inutilizacoes`. Falha da Focus retorna `success:false` com `code: 'focus_error'`.

**4. Polling/reconciliação**
- `fiscal-check-status`: idempotência adicionada — **status terminal** (`authorized`, `cancelled`, `rejected`) **nunca é sobrescrito** por nova consulta ao Focus. Tenant guard reforçado no `update`.
- `fiscal-get-status`: já retornava cedo em status terminal; tenant guard reforçado no `update`.
- Mapa de status (oficial — `_shared/focus-nfe-adapter.ts:mapFocusStatusToInternal`):
  - `processando_autorizacao` → `processing`
  - `aguardando_correcao` → `pending`
  - `autorizado` → `authorized` (terminal)
  - `cancelado` → `cancelled` (terminal)
  - `erro_autorizacao` / `denegado` → `rejected` (terminal)
  - default → `processing`
- `error` é reservado para falha técnica (exceções/IO), nunca para rejeição Sefaz.

**5. Idempotência por `focus_ref`**
- `fiscal-emit` e `fiscal-submit` reutilizam o `focus_ref` existente quando há (`invoice.focus_ref || generateNFeRef(invoice_id)`).
- Re-emissão é bloqueada quando `status NOT IN ('draft','rejected')` — impede transmissão duplicada de uma nota já em processamento, autorizada ou cancelada.
- `fiscal-webhook` mantém idempotência: status terminal igual ao recebido vira noop seguro com evento `webhook_<status>_noop`.
- `rejected` continua permitindo nova tentativa (correção de rascunho rejeitado), conforme regra de negócio aprovada.

**6. RBAC consolidado para ações fiscais sensíveis**
| Ação | owner | admin | operator | member | viewer |
|---|---|---|---|---|---|
| Emitir NF (emit/submit) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cancelar NF | ✅ | ✅ | ❌ | ❌ | ❌ |
| Enviar CC-e | ✅ | ✅ | ❌ | ❌ | ❌ |
| Inutilizar numeração | ✅ | ✅ | ❌ | ❌ | ❌ |
| Atualizar rascunho | ✅ | ✅ | ✅ | ❌ | ❌ |
| Consultar status | ✅ | ✅ | ✅ | ✅ | ✅ |

> Liberação granular para `operator` em qualquer ação sensível requer aprovação explícita do produto. Papel financeiro/`finance` ainda não existe no RBAC atual; documentado como possibilidade futura, sem implementação.

### Webhook Focus NFe — instrução operacional

**URL de destino do webhook:**
```
https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/fiscal-webhook
```

**Autenticação do webhook (3 formatos aceitos pelo nosso endpoint, em ordem de preferência):**

1. **Header customizado (recomendado, se o painel Focus permitir):**
   ```
   X-Webhook-Secret: <FOCUS_NFE_WEBHOOK_SECRET>
   ```

2. **HTTP Basic Auth (se o painel Focus permitir credenciais):**
   ```
   usuário: focus
   senha:   <FOCUS_NFE_WEBHOOK_SECRET>
   ```

3. **Query string (fallback — usar somente se o painel Focus aceitar apenas URL):**
   ```
   https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/fiscal-webhook?secret=<FOCUS_NFE_WEBHOOK_SECRET>
   ```

> Substituir `<FOCUS_NFE_WEBHOOK_SECRET>` pelo **mesmo valor** cadastrado na secret da Lovable. **Nunca** versionar o valor real no repositório, em logs, em prints de configuração ou em mensagens de chat. Se o painel Focus não suportar nem header nem Basic Auth, usar a forma de query — funcional, porém com a observação de que a string fica visível em logs de proxy/HTTP.

**Eventos recomendados na Focus NFe:**
- `nfe_autorizacao` (status final autorizado)
- `nfe_cancelamento` (status final cancelado)
- `nfe_erro_autorizacao` (rejeição Sefaz)
- `nfe_denegada` (denegação Sefaz)
- `cce_autorizacao` (carta de correção autorizada) — opcional, pois o envio de CC-e é síncrono
- `inutilizacao_autorizada` — opcional

**Empresa/tenant Focus:** o webhook é único por instância (multi-tenant): o roteamento interno é feito por `focus_ref` → `fiscal_invoices.tenant_id`. Cadastrar **um único webhook na empresa Focus do tenant Respeite o Homem** (homologação) é suficiente.

**Validação operacional do webhook (sem emitir NF real):**
1. Verificar nos logs da função `fiscal-webhook` que o cabeçalho `[fiscal-webhook] ========== WEBHOOK RECEIVED ==========` apareceu após salvar a configuração na Focus (a Focus normalmente envia um ping/teste).
2. Confirmar que `[webhook-secret] FOCUS_NFE_WEBHOOK_SECRET not configured` **não aparece**.
3. Se aparecer `[webhook-secret] Invalid or missing webhook secret`, a string cadastrada no painel Focus diverge da secret — corrigir.

**Se o painel Focus não permitir header nem Basic Auth:** usar `?secret=` na URL e aceitar o trade-off de visibilidade em logs intermediários. Caso queiram um nível adicional, podemos avaliar IP allowlist como evolução futura (não está no escopo desta etapa).

### Testes executados (sem transmissão real)

| Teste | Resultado |
|---|---|
| Revisão de código `fiscal-cancel`/`-cce`/`-inutilizar` para CORS, envelope e RBAC | ✅ |
| Bloqueio de `operator`/`member`/`viewer` para cancelar/CC-e/inutilizar (revisão de `requireFiscalRole`) | ✅ |
| Tenant A não consegue cancelar NF do tenant B (filtro `.eq('tenant_id', tenantId)` no select) | ✅ |
| Cancelamento de NF já cancelada → noop sem nova chamada Focus | ✅ por construção |
| Inutilização de faixa já autorizada → noop sem nova chamada Focus | ✅ por construção |
| `fiscal-check-status`: status terminal não é sobrescrito por novo polling | ✅ guard adicionado |
| Webhook sem segredo válido → `401` | ✅ herdado do Lote 1.C.2 |
| Webhook duplicado em status terminal igual → noop sem update | ✅ herdado do Lote 1.C.2 |
| `fiscal-emit`/`fiscal-submit` recusam status `processing/authorized/cancelled` | ✅ check `status IN ('draft','rejected')` |
| Erros de negócio retornam `200 + success:false` | ✅ envelope unificado |

### Confirmação de não-transmissão

Nenhuma chamada real a `api.focusnfe.com.br` nem `homologacao.focusnfe.com.br`. Nenhuma NF, cancelamento, CC-e ou inutilização real foi transmitida. Certificado A1 não foi tocado. Cron/scheduler não foi alterado.

### Checklist final antes do smoke test em homologação

1. Cadastrar `FOCUS_NFE_WEBHOOK_SECRET` no painel Focus NFe (mesma string da secret) usando header `X-Webhook-Secret` ou Basic Auth — fallback `?secret=` se necessário.
2. Confirmar empresa Focus apontando para **ambiente de homologação** do tenant Respeite o Homem.
3. Validar que o webhook recebe ping da Focus sem `Invalid or missing webhook secret`.
4. Confirmar que `fiscal_settings.focus_ambiente = 'homologacao'` para o tenant em teste.
5. Confirmar certificado A1 válido carregado para o CNPJ do emitente (CNPJ certificado == CNPJ emitente).
6. Selecionar **um pedido de teste** com cliente, endereço, itens e CFOP/NCM válidos.
7. Smoke test: rascunho → submit → aguardar webhook → confirmar `authorized` → conferir `xml_url` e `danfe_url`.
8. Smoke test cancelamento: cancelar a NF de teste com justificativa de 15+ chars → confirmar `cancelled` no banco.
9. Smoke test CC-e (opcional): enviar uma CC-e de teste numa NF de teste autorizada → confirmar `cce_authorized`.
10. **Não habilitar emissão para tenants em produção** até validação acima.

### Riscos restantes

- O smoke test em homologação **ainda não foi executado**.
- Polling/reconciliação proativo (cron) para notas presas em `processing`/`pending` ainda não está implementado — depende do webhook Focus na maioria dos casos. Avaliar no Lote 1.D.
- `fiscal-cce` e `fiscal-inutilizar` chamam Focus diretamente via `fetch` em vez do `_shared/focus-nfe-client.ts`. Funcional, mas sem retentativa centralizada. Considerar refator no Lote 1.D.
- `error` (falha técnica) ainda não é gravado de forma sistemática nas funções de polling — hoje retorna `success:false` para o cliente. Avaliar persistir `status=error` quando a Focus responder 5xx repetidamente.

---

## Lote 1.D — Reconciliação fiscal segura (pré-smoke test)

**Status:** implementado em modo manual/dry-run. Sem cron ativo.

### Objetivo

Permitir destravar NF-e que ficarem em `pending`/`processing`/`error` caso o webhook Focus não chegue, **sem** rotina global varrendo produção e **sem** risco de retransmissão.

### Mecanismo

Edge function: `fiscal-reconcile` (acionável manualmente via `supabase.functions.invoke('fiscal-reconcile', { body: {...} })` ou via service_role para uso interno no smoke test).

### Modos

| Modo | Quando usa | Comportamento |
|---|---|---|
| `dry_run` (padrão) | Default em qualquer chamada sem `dry_run:false` | Lista as notas que seriam reconciliadas, **não chama Focus**, não altera nada |
| `executed` | Apenas quando `dry_run:false` E (env `FISCAL_RECONCILE_ENABLED=true` OU tenant em `FISCAL_RECONCILE_TENANT_ALLOWLIST` OU `fiscal_settings.focus_ambiente='homologacao'`) | Consulta status real na Focus e atualiza |
| `blocked_by_scope` | `dry_run:false` mas escopo não autorizado | Recusa, devolve relatório como dry-run |

### Critérios de seleção das notas

- `tenant_id` = tenant do chamador (ou explícito quando service_role)
- `focus_ref IS NOT NULL`
- `status IN ('pending','processing','error')`
- `reconcile_attempts < 5` (limite de tentativas)
- `last_reconcile_at` mais antigo primeiro (ordenação)
- backoff mínimo de **60s** entre tentativas para a mesma nota
- limite de **25 notas** por chamada (`HARD_LIMIT`), default 10

### Idempotência e segurança

- **Status terminal preservado:** `authorized`, `cancelled`, `rejected` nunca são sobrescritos.
- **Sem reemissão:** a função apenas consulta status (`getNFeStatus`) — não chama submit, cancel, CC-e nem inutilização.
- **Tenant guard:** `eq('tenant_id', tenantId)` em todo `select` e `update`.
- **RBAC:** apenas `owner`/`admin` ou `service_role` com `tenant_id` explícito.
- **Falha técnica não rebaixa status:** registra `last_reconcile_error` e incrementa `reconcile_attempts`, mantém status atual.
- **Convivência com webhook:** se webhook chegar primeiro e marcar terminal, o polling vê e respeita; se polling marcar terminal antes, webhook duplicado também vira noop (já protegido pelo Lote 1.C.2).
- **Logs:** registram apenas `from`, `to`, `focus_status`, `mensagem_sefaz`, `actor`, `attempt`. Nenhum XML, token, certificado ou senha.

### Migration (Lote 1.D)

Adicionados em `fiscal_invoices`:
- `reconcile_attempts integer NOT NULL DEFAULT 0`
- `last_reconcile_at timestamptz`
- `last_reconcile_error text`
- Índice parcial em `(tenant_id, status, last_reconcile_at)` para `status IN ('pending','processing','error') AND focus_ref IS NOT NULL`.

### Cron / scheduler

**Nenhum cron foi criado.** O escopo do Lote 1.D explicitamente proíbe varredura global em produção antes do smoke test. A função é manual.

Após o smoke test em homologação validado, avaliar (em lote separado) cron com:
- escopo restrito ao(s) tenant(s) em `FISCAL_RECONCILE_TENANT_ALLOWLIST`;
- frequência inicial sugerida: a cada 5 min;
- só entra em produção após validação.

### Testes executados sem transmissão real

| Teste | Resultado |
|---|---|
| Migration aplicada (colunas + índice) | ✅ |
| Deploy `fiscal-reconcile` | ✅ |
| Revisão: dry_run é default e não chama Focus | ✅ |
| Revisão: usuário não-admin é rejeitado pelo `requireFiscalRole(['owner','admin'])` | ✅ |
| Revisão: service_role sem `tenant_id` é rejeitado | ✅ |
| Revisão: usuário não pode reconciliar tenant alheio | ✅ |
| Revisão: status terminal não é sobrescrito | ✅ (guard `TERMINAL.has(inv.status)`) |
| Revisão: notas sem `focus_ref` são ignoradas | ✅ (`.not('focus_ref','is',null)`) |
| Revisão: limite de 5 tentativas é aplicado no SQL | ✅ |
| Revisão: backoff de 60s é aplicado em memória | ✅ |
| Revisão: produção fora de allowlist é bloqueada mesmo com `dry_run:false` | ✅ |
| Revisão: sem chamada a `submit`/`cancel`/`cce`/`inutilizar` | ✅ apenas `getNFeStatus` |

### Confirmação de não-transmissão (Lote 1.D)

- ✅ Nenhuma NF nova foi emitida.
- ✅ Nenhum cancelamento real foi feito.
- ✅ Nenhuma CC-e foi enviada.
- ✅ Nenhuma inutilização foi feita.
- ✅ Nenhuma chamada real a `api.focusnfe.com.br` ou `homologacao.focusnfe.com.br` foi disparada nesta etapa.
- ✅ Certificado A1 não foi tocado.
- ✅ Nenhum cron novo em produção.

### Webhook Focus — checklist operacional (recapitulação)

- URL: `https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/fiscal-webhook`
- Secret: enviar via header `X-Webhook-Secret`, Basic Auth ou query `?secret=` (mesmo valor de `FOCUS_NFE_WEBHOOK_SECRET`).
- Eventos recomendados: `nfe_autorizada`, `nfe_cancelada`, `nfe_denegada`, `nfe_rejeitada`.
- Empresa Focus: tenant Respeite o Homem em ambiente **homologação**.
- Validação: ao salvar a configuração no painel, a Focus envia evento de teste — confirmar 200 OK no log de `fiscal-webhook` sem necessidade de emitir NF.
- **Nunca** colar o valor real do secret em doc, ticket ou log.

### Riscos restantes

- Smoke test em homologação ainda não executado.
- Função `fiscal-reconcile` ainda não foi exercitada contra Focus real (dry-run apenas).
- Sem cron: se o webhook falhar e ninguém acionar a reconciliação manual, nota fica em `processing` indefinidamente. Aceitável pré-smoke; cron entra em lote separado.
- `fiscal-cce` e `fiscal-inutilizar` ainda chamam Focus via `fetch` direto (não migrados para `_shared/focus-nfe-client.ts`) — pendência herdada do Lote 1.C.3.

### Checklist final para autorizar smoke test em homologação

1. ☐ `FOCUS_NFE_WEBHOOK_SECRET` cadastrado no painel Focus.
2. ☐ Empresa Focus do tenant Respeite o Homem em ambiente homologação.
3. ☐ Webhook recebendo ping da Focus sem `401`.
4. ☐ `fiscal_settings.focus_ambiente='homologacao'` para o tenant em teste.
5. ☐ Certificado A1 válido carregado, CNPJ do certificado == CNPJ emitente.
6. ☐ Pedido de teste preparado (cliente, endereço, item, CFOP/NCM válidos).
7. ☐ Conferir que `fiscal-reconcile` em `dry_run:true` lista 0 notas presas (estado limpo).
8. ☐ Após emissão, se nota ficar em `processing`, acionar `fiscal-reconcile` com `dry_run:false` no tenant de teste e confirmar transição para `authorized`.
9. ☐ Após smoke test OK, decidir habilitação de cron restrito (lote separado).

---

## Lote 1.E — Webhook multi-tenant + gate de emissão (2026-05-14)

Encerra a preparação técnica para o smoke test em homologação do tenant piloto. Implementa cadastro automático do webhook Focus NFe **por loja**, com token único por tenant, e adiciona um **gate de emissão** que bloqueia produção sem webhook validado e gera **alerta não-bloqueante** em homologação.

### Campos por tenant em `fiscal_settings`

| Campo | Função |
|---|---|
| `webhook_status` | `not_configured` \| `pending` \| `validated` \| `error` |
| `webhook_environment` | Ambiente em que o hook foi cadastrado (`homologacao`/`producao`) |
| `webhook_url_sanitized` | URL pública do callback (sem token) — segura para exibir na UI |
| `webhook_tenant_token` | **Sensível.** Token único do tenant usado na query `?t=...`. Não retornado em selects da UI. |
| `webhook_focus_hook_id` | ID do hook na Focus (para deletar/atualizar) |
| `webhook_registered_at` / `webhook_validated_at` | Timestamps |
| `webhook_last_received_at` / `webhook_last_error` / `webhook_last_error_at` | Telemetria do recebimento |
| `webhook_token_rotated_at` | Última rotação do token |
| `focus_company_status` | Saúde da empresa na Focus (campo declarado, populado em validação futura) |

### Edge functions desta onda

- `fiscal-webhook-register` *(novo)* — owner/admin. Cadastra/atualiza o hook na Focus NFe via `POST /v2/hooks`. Faz lookup prévio para evitar duplicidade (`GET /v2/hooks?cnpj=…`), deleta o hook antigo se a URL com token mudou, regrava `webhook_status=pending`, salva `webhook_url_sanitized`, `webhook_focus_hook_id`, `webhook_environment`. Suporta `dry_run` e `rotate_token`. Em falha, retorna fallback manual com `manual_register_url` (contém o token por loja, **nunca o secret global**).
- `fiscal-integration-validate` *(novo)* — owner/admin. Retorna `cards[]` (Empresa Focus, Certificado, Webhook, Ambiente) + `ready_for_production` + `ready_for_homologation_smoke`. Faz best-effort `GET /v2/empresas/{cnpj}` para confirmar a empresa. **Não** retorna PFX, senha, token Focus ou token da loja.
- `fiscal-webhook` *(ajustado na Parte 1)* — autenticação preferencial via `?t=<webhook_tenant_token>` (tenant guard contra o `focus_ref`). Mantém compatibilidade com `FOCUS_NFE_WEBHOOK_SECRET` global. Promove `webhook_status: pending → validated` ao primeiro callback bem-sucedido e atualiza `webhook_last_received_at`.
- `fiscal-emit` / `fiscal-submit` *(ajustados nesta Parte 2)* — chamam `evaluateEmissionGate()` antes de qualquer transmissão.

### Gate de emissão (`_shared/fiscal-emission-gate.ts`)

**Em produção, bloqueia (HTTP 200 + `success:false`, com `code`):**
- `focus_company_missing` — empresa Focus ausente
- `certificate_missing` — certificado A1 ausente
- `certificate_expired` — certificado vencido
- `certificate_cnpj_mismatch` — CNPJ certificado ≠ CNPJ emitente
- `webhook_not_validated` — `webhook_status != validated`
- `webhook_environment_mismatch` — webhook cadastrado em ambiente diferente
- `webhook_tenant_token_missing` — token por loja ausente

**Em homologação, nunca bloqueia por webhook.** Devolve `warnings[]` no payload sempre que `webhook_status` for `not_configured`, `pending` ou `error`, ou quando o ambiente do hook não coincidir com o ambiente fiscal atual. Permite o smoke test desde que os pré-requisitos não-webhook (empresa Focus + certificado válido + CNPJ batendo) estejam OK.

RBAC inalterado: `fiscal-emit` e `fiscal-submit` continuam exigindo `owner`/`admin`. `operator` permanece bloqueado para emissão real.

### UI — Validação Fiscal (rev 2026-05-14d — bloco único de prontidão)

A partir desta revisão, a tela fiscal tem **um único bloco principal de status fiscal**: o card superior "Pronto para emitir NF-e?" em `EmitenteSettings.tsx`. O card compacto "Validação Fiscal" que ficava ao lado do "Ambiente de Emissão" foi **removido** (`FiscalValidationCompactCard.tsx` deletado). O bloco "Ambiente de Emissão" continua existindo como card próprio, mas serve apenas para selecionar/exibir o ambiente — não tem mais lista de validação.

- O bloco principal mostra: status geral (selo único), mensagem de ação principal (apenas em estados não-OK) e a lista resumida de itens com rótulos de negócio: **Empresa fiscal**, **Certificado A1**, **Credenciais fiscais**, **Recebimento de retornos**, **Ambiente atual**.
- O link "Ir para" só aparece em itens com `goto: true` no contrato (problemas de campo cadastral real do usuário). Erros internos de preparação/provedor **não** mostram "Ir para".
- O botão **"Reprocessar configuração fiscal"** só aparece quando `next_action_kind === 'retry'` ou `can_retry_activation === true`. Ele re-executa a validação (que internamente dispara a preparação automática quando necessário). Não emite NF, não chama `fiscal-emit`, não chama `fiscal-submit`, não transmite para Sefaz.
- Não existe mais botão "Validar integração fiscal" como etapa obrigatória do usuário. A validação é automática (rodada no carregamento da tela e no reprocessamento).
- Mensagem genérica errada ("Conclua os dados fiscais e envie o certificado A1") **não pode aparecer** quando os dados estão completos e o certificado é válido. Nesse caso o backend devolve `reason_code` específico (`provider_setup_error`, `credentials_capture_error`, `returns_setup_error`) e a mensagem reflete a causa real.
- A UI **nunca** exibe `FOCUS_NFE_WEBHOOK_SECRET`, PFX, senha do certificado nem `provider_token` da Focus, e **não usa** os termos "Focus NFe", "webhook", "hook", "secret", "token", "API", "provider", "sincronizar empresa" ou "cadastrar empresa no provedor" no corpo principal.
- `operator` não tem acesso à página de configurações fiscais (gate em `useTenantAccess`).
- A URL legada `?aba=integracao` deixou de existir e cai no comportamento padrão (`emitente`).

#### Contrato `fiscal-integration-validate` — `reason_code`

Resposta inclui `reason_code` no topo e (quando aplicável) por card. Valores: `missing_company_data`, `certificate_missing`, `certificate_invalid`, `certificate_expired`, `certificate_cnpj_mismatch`, `provider_setup_pending`, `provider_setup_error`, `credentials_capture_error`, `returns_setup_pending`, `returns_setup_error`, `ready_for_test`, `ready_for_production`, `production_blocked`. Também devolve `next_action_kind` (`'goto' | 'retry' | null`) para a UI escolher entre "Ir para" e "Reprocessar configuração fiscal" sem heurística no frontend. Nenhum dado sensível é exposto neste contrato.


### Configuração de deploy

`supabase/config.toml` agora registra:
- `[functions.fiscal-webhook-register] verify_jwt = true`
- `[functions.fiscal-integration-validate] verify_jwt = true`
- `[functions.fiscal-webhook] verify_jwt = false` (mantido — autenticação por token na URL/secret global)

### Segurança

- Secret global `FOCUS_NFE_WEBHOOK_SECRET` **nunca** é retornado por nenhuma function nem exibido em UI/log/payload.
- `webhook_tenant_token` é exposto **apenas** no payload do `fiscal-webhook-register` quando o cadastro automático falha (fluxo de fallback manual). Em logs ele é mascarado (`***`). Em selects gerais ele não vai para a UI.
- O token é rotacionável (`rotate_token: true`) e cada rotação atualiza o hook na Focus para a nova URL.
- Tenant guard duplo no webhook: o token por loja resolve `tenant_id`; em seguida, `focus_ref` precisa pertencer ao mesmo tenant.

### Status do tenant Respeite o Homem (apuração desta etapa, sem alterar webhook real)

| Item | Status |
|---|---|
| Empresa Focus (`focus_empresa_id`) | ✅ presente (`211379`) |
| Certificado A1 | ✅ válido (até 2027-02-16), CNPJ confere |
| Ambiente fiscal | ⚠ atualmente `producao` |
| Webhook | ❌ `not_configured` — nenhum cadastro feito nesta etapa |
| Pronto para smoke test em homologação | Pendente: trocar ambiente para `homologacao` antes do smoke. |
| Pronto para emissão em produção | ❌ bloqueado pelo gate (`webhook_not_validated`). |

> Nenhum cadastro real de webhook foi feito para o tenant Respeite o Homem nesta etapa. A Parte 2 entrega a infraestrutura; o cadastro real será disparado depois, via botão da UI ou comando autorizado pelo usuário.

### Testes executados sem emissão real

| Teste | Resultado |
|---|---|
| Deploy `fiscal-webhook-register` + `fiscal-integration-validate` registrados em `config.toml` | ✅ |
| Gate em produção bloqueia quando `webhook_status != validated` | ✅ revisão estática + `evaluateEmissionGate` retorna `code:webhook_not_validated` |
| Gate em homologação não bloqueia por webhook ausente; devolve `warnings[]` | ✅ |
| Pré-requisitos de empresa/certificado continuam validados em ambos os ambientes | ✅ |
| `operator` não emite, não submete, não acessa configurações | ✅ herdado dos lotes 1.B/1.C |
| Fallback manual exibe token mascarado por padrão; “Revelar” é ação explícita | ✅ |
| `webhook_tenant_token` não aparece em payload de validação | ✅ função `fiscal-integration-validate` filtra colunas |
| Secret global jamais é retornado para UI | ✅ revisão de payloads |
| Cadastro automático no tenant Respeite o Homem | ⏸ não executado (aguardando autorização explícita) |
| Nenhuma chamada real a `api.focusnfe.com.br` ou `homologacao.focusnfe.com.br` para emissão | ✅ |
| Certificado A1 não foi tocado | ✅ |

### Riscos restantes

- Tenant Respeite o Homem está em `ambiente=producao` no `fiscal_settings`. Para o smoke test ele precisa ir para `homologacao` antes — caso contrário o gate de produção bloqueia (e isso é o esperado).
- Cadastro real do webhook ainda não foi disparado: até lá, `webhook_status=not_configured` permanece, e produção segue bloqueada por design.
- `fiscal-cce` e `fiscal-inutilizar` ainda usam `fetch` direto (pendência herdada do Lote 1.C.3) — não impacta o smoke de NFe.

### Checklist final para autorizar cadastro real do webhook + smoke test em homologação

1. ☐ Trocar `fiscal_settings.ambiente` (e `focus_ambiente`) do tenant Respeite o Homem para `homologacao`.
2. ☐ Confirmar empresa Focus em homologação para o CNPJ piloto (`63.269.917/0001-06`).
3. ☐ Acessar **Sistema → Configurações → aba Fiscal → Configurações Fiscais** como owner/admin → no card **Validação Fiscal** (ao lado do Ambiente de Emissão), clicar **Ativar recebimento automático de retornos**.
4. ☐ Confirmar `webhook_status=pending` e `webhook_url_sanitized` salvos.
5. ☐ Aguardar primeiro evento da Focus → `webhook_status` deve transicionar para `validated`.
6. ☐ Conferir `ready_for_homologation_smoke = true` em **Validar integração fiscal**.
7. ☐ Pedido de teste preparado com endereço/itens válidos.
8. ☐ Emitir NF-e de teste em homologação. Validar autorização ou usar `fiscal-reconcile` se ficar `processing`.
9. ☐ Em sucesso, planejar troca para `producao` em lote separado, recadastrar o webhook em produção e refazer a validação antes de liberar emissão real.

---

## Regras anti-regressão (rev 2026-05-14b)

Estas regras devem ser preservadas em qualquer refatoração futura do módulo fiscal:

1. **Tokens por empresa nunca voltam a ser input manual do lojista no fluxo padrão.** Os tokens `token_homologacao` e `token_producao` retornados pela API Focus NFe (criar/atualizar/consultar empresa) são capturados automaticamente por `fiscal-sync-focus-nfe` e armazenados de forma segura por tenant em `fiscal_settings.focus_token_homologacao` / `fiscal_settings.focus_token_producao` (criptografados, sem `SELECT` para `anon`/`authenticated`). A UI comum **não** expõe campos de token. Qualquer reabertura desses campos em fluxo padrão é proibida.

2. **A tela fiscal tem UM ÚNICO bloco principal de prontidão fiscal** — o card superior em `EmitenteSettings.tsx`, alimentado por `useFiscalReadiness` (`src/hooks/useFiscalReadiness.ts`) e pela edge function `fiscal-integration-validate`. É proibido recriar um segundo card de readiness na mesma tela (o antigo `FiscalValidationCompactCard.tsx` foi removido em 2026-05-14d). É proibido criar lógica de prontidão paralela no frontend. O card "Ambiente de Emissão" só seleciona/exibe o ambiente, não duplica a lista de validação. Mensagens devem refletir o `reason_code` retornado pelo backend — nunca usar "Conclua os dados fiscais e envie o certificado A1" quando dados/certificado já estão OK. O botão "Validar integração fiscal" não pode aparecer como etapa obrigatória; o botão de ação principal em estados de erro/preparação é "Reprocessar configuração fiscal" (não emite NF, não transmite à Sefaz).

3. **Recebimento automático de retornos é ativado pelo backend, não pelo lojista.** Quando os pré-requisitos estão completos, `fiscal-integration-validate` ativa automaticamente. Botões de retry só aparecem como fallback de erro real, em linguagem de negócio. Não pode existir botão obrigatório "Ativar recebimento automático" no fluxo comum.

4. **Linguagem de negócio na UI fiscal.** Termos proibidos no fluxo comum: token, webhook, hook, API, Focus NFe, sincronizar empresa, cadastrar empresa no provedor. Estados permitidos: "Configuração fiscal pendente", "Preparando emissão automática", "Pronto para teste", "Pronto para emitir NF-e", "Configuração fiscal com erro", "Produção bloqueada".

5. **Produção bloqueada por padrão.** Produção só é liberada quando `ready_for_production = true` no retorno de `fiscal-integration-validate` — ou seja, todos os requisitos reais validados (cadastro Focus, certificado válido e não divergente, recebimento automático ativo, token de produção presente).

## Anti-regressão — Segurança de logs do certificado A1

**Proibido em qualquer função fiscal:**
- Logar conteúdo, amostra, prefixo ou sufixo do PFX (descriptografado **ou** criptografado).
- Logar a senha do certificado, mesmo parcialmente.
- Logar `arquivo_certificado_base64` ou `senha_certificado` no payload da Focus NFe — sempre redigir como `[REDACTED]` antes de serializar.
- Serializar exceções com `JSON.stringify(error)` quando o objeto pode conter o payload do certificado.

**Permitido:** logar apenas comprimento e operação (ex.: `pfxLength`, `senhaLength`, "decryption ok"), nunca conteúdo.

**Resposta a incidente:** se um PFX ou senha aparecer em log de produção, o certificado A1 é tratado como **potencialmente comprometido**. Produção continua bloqueada até substituição do certificado e (se aplicável) revogação do anterior junto à AC. Trocar apenas a senha não sana exposição do PFX.

## Caminho A — Recriação limpa da empresa em homologação

Quando o `focus_empresa_id` ficar órfão no provedor (empresa não existe mais lá, mas o id está salvo), a operação de saneamento é:
1. Setar `focus_empresa_id = NULL`, `focus_company_status = 'unknown'`, `focus_ultima_sincronizacao = NULL`, `webhook_status = 'pending'`, `webhook_environment = 'homologacao'`, `is_configured = false` no `fiscal_settings` do tenant.
2. Próximo carregamento da tela fiscal pelo owner aciona `fiscal-integration-validate` → `fiscal-sync-focus-nfe`, que executa `getEmpresa(cnpj)`; se não existir, faz `POST` (cadastro novo) usando os dados atuais do emitente. **Não há reemissão de certificado fora do que já está salvo.**
3. Tokens de homologação/produção são capturados automaticamente do retorno do provedor — o lojista nunca os digita.


## Ambiente de emissão (UI lojista) — atualização

- Lojista comum NÃO escolhe ambiente na UI. O bloco "Ambiente de Emissão" exibe apenas status informativo:
  - Homologação → "Modo de teste fiscal ativo" (sem valor fiscal, uso técnico/piloto).
  - Produção → "Ambiente de emissão: Produção" (valor fiscal real).
- Homologação é modo técnico/piloto/suporte. Produção é o fluxo padrão do lojista.
- Troca de ambiente é controle técnico/admin (backend/platform admin), fora da UI comum.
- Tenant piloto Respeite o Homem permanece em homologação para validação técnica.

## Pedidos de Marketplace na Esteira Fiscal (2026-05-17 — Onda 4)

Pedidos importados de Mercado Livre e Shopee seguem a mesma esteira fiscal de pedidos da loja própria, com duas regras adicionais:

### 1. Bloqueio por Item Sem Vínculo
Itens de marketplace cujo SKU não corresponde a um produto cadastrado entram em `order_items` com `product_id = NULL`. O trigger `enqueue_fiscal_draft` consulta a função `order_has_unlinked_items(order_id)` e **NÃO insere** em `fiscal_draft_queue` enquanto houver qualquer item pendente. Isso evita criar Pedido de Venda fiscal com dados incompletos (sem peso, NCM, GTIN, Origem).

### 2. Vínculo Manual Reativa a Fila
Quando o operador vincula um produto local a um item antes pendente (UPDATE em `order_items.product_id`), o trigger `enqueue_fiscal_on_item_link` re-avalia o pedido. Se ele está pago (`payment_status = 'approved'`) e todos os itens agora têm `product_id`, o pedido entra automaticamente em `fiscal_draft_queue`.

### 3. UI de Vínculo (Tela do Pedido)
Em `/orders/:id`, a seção "Itens do Pedido" mostra banner amarelo + badge "Pendente de vínculo" por item, com botão "Vincular produto" que abre `ProductSelector`. Ao confirmar, herda automaticamente `weight`, `barcode`, `ncm` do cadastro.

### 4. Frete e Roteamento de Remessa
Pedidos com `marketplace_source IN ('mercadolivre','shopee')` retornam `reason = 'marketplace'` em `resolve_order_shipping_provider` — não entram em `shipping_draft_queue` nem em `gateway_sync_queue`. O envio é responsabilidade do marketplace.

## Cálculo Automático de Impostos por Regime (2026-05-17 — Onda 5)

Configuração em Fiscal → Emitente → "Tributos PIS, COFINS e ICMS" (visível só para Regime Normal). Campos: `regime_tributario`, `pis_aliquota_padrao`, `cofins_aliquota_padrao`, `icms_aliquota_padrao`, `pis_cst_padrao`, `cofins_cst_padrao`. Override por produto em `fiscal_products`: `pis_aliquota`, `cofins_aliquota`, `icms_aliquota`, `pis_cst`, `cofins_cst`.

Motor compartilhado: `supabase/functions/_shared/fiscal-tax-calculator.ts` (`calculateItemTaxes`). Aplicado em `fiscal-create-draft` e `fiscal-auto-create-drafts` no momento de montar os itens do Pedido de Venda. A NF clona os itens do Pedido (`fiscal-prepare-invoice`), portanto herda os impostos sem recalcular.

Regras:
- **Simples Nacional** (`regime_tributario='simples_nacional'`, CRT=1 ou 2): PIS/COFINS/ICMS zerados, usa `csosn`. Apuração real via DAS.
- **MEI — Microempreendedor Individual** (`regime_tributario='mei'`, CRT=4): mesmo tratamento prático do Simples Nacional (PIS/COFINS/ICMS zerados, CSOSN padrão 102). A diferença está no código enviado à SEFAZ: `regime_tributario=4` no payload Focus NFe, evitando rejeição por divergência cadastral em CNPJs MEI. Selecionar CRT=4 na UI auto-define `regime_tributario='mei'` automaticamente. Adicionado em 2026-05-19.
- **Lucro Presumido / Real** (CRT=3): aplica `aliquota%` sobre o `valor_total` do item, usa `cst`. Precedência: override do produto → padrão do tenant → zero.

## Resolução de IBGE do Município por CEP (2026-05-18c — Hotfix Universal)

**Problema:** a tabela interna `ibge_municipios` continha apenas 123 dos 5.570 municípios brasileiros. O lookup de IBGE por nome de cidade falhava silenciosamente para a maioria dos pedidos (mesmo grafia correta), travando o Pedido de Venda em pendência e bloqueando emissão de NF.

**Solução universal:** o código IBGE do município do destinatário passa a ser resolvido **a partir do CEP**, usando hierarquia oficial:

1. **Cache local** (`cep_cache`) — consulta primeiro, sem custo/latência.
2. **ViaCEP** (oficial Correios) — devolve IBGE de 7 dígitos já pronto.
3. **BrasilAPI** — fallback se ViaCEP estiver fora.
4. **Lookup interno por nome** — última camada (mantida para emergência).

Módulo compartilhado: `supabase/functions/_shared/cep-lookup.ts` (`resolveAddressByCep`).

**Aplicado em:**
- `fiscal-auto-create-drafts` (criação automática do Pedido de Venda).
- `fiscal-create-draft` (criação manual via UI).
- `fiscal-create-manual` (NF avulsa).
- `fiscal-prepare-invoice` — além de validar, **auto-recupera** o IBGE pelo CEP no momento da preparação. Pedidos antigos que estavam pendentes saem automaticamente assim que forem reprocessados.

**Cross-validação UF:** quando o CEP é resolvido com sucesso, comparamos a UF oficial do CEP com a UF informada no pedido. Se forem diferentes, é gerada pendência explícita: *"Endereço incompatível com o CEP: o CEP pertence a {UF_cep}, mas o pedido informa {UF_pedido}. Confirme cidade e estado com o cliente antes de despachar."* — bloqueia emissão de NF e geração de etiqueta. Divergência apenas de grafia de cidade não gera pendência (CEP é a fonte de verdade).

**Backfill:** edge function `fiscal-backfill-ibge` (one-shot, manual) percorre Pedidos de Venda com IBGE ausente e resolve via CEP. Execução de 2026-05-18: 219 pedidos varridos no tenant Respeite o Homem, 115 resolvidos automaticamente, 3 com UF divergente sinalizada, 1 CEP sem retorno (caso real para contato com cliente).

**Mensagem de pendência (quando CEP também não resolve):** *"Não foi possível identificar o município do cliente a partir do CEP — confirme o CEP do endereço."* (substitui a antiga *"Cidade do cliente não localizada na base oficial de municípios..."*).

### Hotfix 2026-05-18d — Normalização do nome do município + limpeza de pendências fantasmas

**Problema 1 — Nome da cidade com typo era enviado para a SEFAZ junto com o IBGE correto.** Após o hotfix 5-18c, o código IBGE passou a vir do CEP, mas o **nome textual** da cidade no pedido continuava sendo o digitado pelo cliente. Exemplos reais no tenant Respeite o Homem: *"São Franciaco do Sul"*, *"Pofto Alegre"*, *"Cachoeiro de itapemirim e"*, *"São Paulo capital"*, *"Marechal  Floriano"* (espaço duplo). A SEFAZ valida que `xMun` (nome) bate com `cMun` (código IBGE) e rejeita NFs com divergência — voltaríamos a ter rejeições na emissão.

**Correção 1:** sempre que o CEP é resolvido com sucesso, o nome oficial do município (retornado pelo ViaCEP/BrasilAPI) sobrescreve o `dest_endereco_municipio` no pedido. Aplicado em todos os 4 motores fiscais (`fiscal-auto-create-drafts`, `fiscal-create-draft`, `fiscal-create-manual`, `fiscal-prepare-invoice`) e no backfill. A UF só é sobrescrita quando já bate com a do pedido — divergência continua virando pendência explícita.

**Problema 2 — 116 pedidos do tenant Respeite o Homem exibiam a mensagem antiga "Cidade não localizada" mesmo já tendo IBGE resolvido.** A primeira versão do backfill só limpava a pendência quando precisava *resolver* o IBGE; pedidos com IBGE já preenchido por outra rota carregavam a mensagem velha indefinidamente.

**Correção 2:** o backfill agora também varre pedidos com IBGE já preenchido e remove pendências obsoletas, retornando ao estágio `pedido_venda` quando não sobra nenhuma outra pendência. Execução de 2026-05-18: 219 varridos, 4 nomes de cidade corrigidos, 7 pendências fantasmas limpas, 3 divergências reais de UF mantidas como pendência legítima ("MATOGROSSO"/"SAO PAULO"/"SO" no lugar da sigla de 2 letras), 1 CEP genuinamente irresolvível (Terenos/MS 79190-000).

**Resultado final:** dos 220 Pedidos de Venda em aberto, 216 estão prontos para emitir e 4 têm pendência real que exige contato com o cliente.

**Anti-regressão:** memória `mem://constraints/fiscal-ibge-resolution-by-cep-primary` ampliada (CEP é fonte primária do **IBGE E do nome** do município).

### Hotfix 2026-05-18e — Divergência de UF (CEP vs pedido) é aviso, não bloqueio

**Problema:** o hotfix 5-18c tratava qualquer divergência entre a UF do CEP e a UF digitada no pedido como pendência bloqueante — o pedido virava "Pendente" e o botão "Criar NF" ficava desabilitado. Isso é cautela excessiva: existem cenários legítimos (endereço de cobrança ≠ entrega, CEPs recentes, digitação errada que o lojista quer revisar mas não impede emissão). A autoridade final sobre aceitar ou rejeitar uma NF é a **SEFAZ**, não o nosso pré-validador.

**Correção:** introduzido o campo `fiscal_invoices.pendencia_avisos jsonb` para avisos informativos. Divergência de UF agora vai para esse campo, é exibida na UI como badge amarelo (com a mesma mensagem orientativa), mas **não bloqueia** a criação da NF. Se a SEFAZ rejeitar na emissão, o fluxo de rejeição atual entra em ação e força correção manual.

**Reclassificação retroativa:** os 3 pedidos do Respeite o Homem que estavam travados apenas por divergência de UF ("MATOGROSSO", "SAO PAULO", "SO") foram movidos automaticamente para `pendencia_avisos` e voltaram ao estado `pedido_venda` (em aberto), prontos para emissão à critério do lojista.

**Aplicado em:** `fiscal-prepare-invoice` (não bloqueia mais por UF mismatch), `fiscal-backfill-ibge` (migra mensagens antigas), `FiscalInvoiceList` (renderiza badge amarelo de avisos em pedidos e NFs).

### Hotfix 2026-05-18f — Serviço da transportadora visível e edição do destinatário com sincronização do cadastro

**Problema 1 — Serviço contratado invisível.** A aba **Transp.** do Pedido de Venda (modelo Bling) exibia transportadora e modalidade, mas não mostrava qual serviço o cliente escolheu no checkout (PAC, SEDEX, Mini Envios, Loggi Express, etc.). A informação existia no pedido original mas não viajava até a NF.

**Correção 1:** novo campo `fiscal_invoices.transportadora_servico` (text, opcional). Preenchido automaticamente pelo `_shared/fiscal-order-mapping.ts` a partir de `orders.shipping_method`/`shipping_service_name` em qualquer motor que crie pedido de venda (auto-create, create-draft manual, create-manual avulsa, update-draft). Exibido na aba **Transp.** como "Serviço contratado" (campo editável para correção pré-despacho) e no card "Dados do Transporte". Funciona para qualquer transportadora (Correios, Frenet, Loggi, futuras). Backfill executado: 221/221 pedidos atuais com serviço preenchido.

**Problema 2 — Edição do destinatário sem sincronização do cadastro.** A aba **Dest.** permitia editar nome, CPF/CNPJ, endereço, telefone e e-mail, mas as alterações ficavam só no pedido. O cadastro do cliente permanecia desatualizado e ninguém era avisado, gerando divergência crônica entre Pedidos e Clientes.

**Correção 2:** ao salvar o Pedido de Venda (ou clicar em "Criar Nota Fiscal"), o editor compara um snapshot dos campos da aba Dest. (nome, CPF/CNPJ, e-mail, telefone, CEP, logradouro, número, complemento, bairro, município, UF) com os valores atuais. Se houver mudança **e** o pedido tiver `customer_id` vinculado, um diálogo intercepta o salvamento com 3 opções:

- **Salvar pedido e atualizar cadastro do cliente** (padrão, destacado): grava no pedido e propaga as mudanças para `customers` (campos correspondentes: `full_name`, `email`, `phone`, `document`, e endereço primário). Use quando o cadastro estava errado.
- **Salvar somente neste pedido**: grava apenas no pedido. Cadastro do cliente permanece. Use para correção pontual (entrega em outro endereço só desta vez).
- **Cancelar**: volta para o editor.

Sem alteração nos campos de destinatário, ou em pedidos sem cliente vinculado (avulsos/manuais), o salvamento segue direto sem perguntar. A regra de enriquecimento automático de perfil (`profile-enrichment-policy-standard`) continua valendo para campos antes nulos no cadastro — este diálogo trata o caso de **sobrescrever** valores existentes.

**Aplicado em:** `_shared/fiscal-order-mapping.ts`, `fiscal-update-draft`, `InvoiceEditor.tsx`, `FiscalInvoiceList.tsx`, `ManualInvoiceDialog.tsx`. Migração `20260518165640_*` adiciona a coluna e faz o backfill a partir de `orders`.

### Hotfix 2026-05-18g — Aba Destinatário travada bloqueava correção de pendências

**Problema.** A aba **Dest.** do editor do Pedido de Venda estava com todos os campos em modo somente leitura quando o pedido vinha de um cliente cadastrado (regra antiga de "fonte de verdade única"). Resultado: quando o Pedido entrava em pendência por dado do destinatário (ex.: cidade com typo sem match no IBGE), o usuário **não conseguia corrigir dentro do pedido** — só via "Abrir cadastro", o que exige sair do fluxo, voltar e reprocessar. Pendência crônica sem caminho prático de resolução.

**Correção.** O travamento (`lockClientFields`) foi removido da aba Dest. Os campos voltam a ser editáveis no editor do Pedido de Venda e da NF. A integridade com o cadastro do cliente continua garantida pelo **diálogo de sincronização** já existente (Hotfix 2026-05-18f): ao salvar com alterações no destinatário, o sistema pergunta se deve atualizar também o cadastro do cliente, salvar só no pedido ou cancelar. Campos fiscais do item (NCM, CFOP, Origem, GTIN) **continuam somente leitura** quando vinculados a produto cadastrado — esses correções continuam sendo feitas no módulo de Produtos.

**Aplicado em:** `src/components/fiscal/InvoiceEditor.tsx` (constante `lockClientFields` agora sempre `false`).

**Validação técnica:**
- Pedido #233 (Respeite o Homem) com pendência de cidade — campos da aba Dest. ficam habilitados para edição (Nome, CPF/CNPJ, IE, Endereço completo, Telefone, E-mail).
- Diálogo de sincronização do cadastro continua disparando ao salvar com alterações + `customer_id` presente.
- Campos de item (NCM/CFOP/Origem/GTIN) permanecem bloqueados quando há `product_id` — comportamento preservado.

### Hotfix 2026-05-18h — Fechamento automático pós-salvar + paginação das listas

**Problema 1 — fluxo de salvar lento.** Ao salvar o Pedido de Venda (ou rascunho de NF), o editor permanecia aberto e o usuário precisava clicar em "Fechar" manualmente para voltar à listagem e continuar revisando outros pedidos. Fluxo improdutivo, especialmente em lotes.

**Problema 2 — listas sem paginação.** As abas **Pedidos de Venda** e **Notas Fiscais** carregavam e renderizavam todos os registros do tenant em uma única página. Com 221 pedidos em aberto hoje o usuário sente a lista pesada; e o limite técnico de 1.000 linhas por consulta (Supabase) gera risco real de pedidos "sumirem" silenciosamente conforme o volume cresce.

**Correção.**
1. **Fechamento automático.** O editor de NF/Pedido fecha sozinho após salvar com sucesso (caminho direto e caminho do diálogo de sincronização do cadastro). O caminho de "Salvar e criar NF" continua mantendo o editor aberto até a etapa encadeada concluir.
2. **Destaque + scroll.** A linha do registro recém-salvo recebe um destaque visual (~2,5s) e a lista rola automaticamente até ela. Se a linha estiver em outra página, a lista pula para a página correta antes do scroll.
3. **Paginação.** Listas paginadas no cliente (já que a consulta atual carrega todo o tenant) com seletor 25 / 50 / 100 / 200 por página (padrão 50), contador "X – Y de Z" e controles Primeira / Anterior / Próxima / Última. A página atual reseta para 1 sempre que qualquer filtro (aba, busca, status, datas, marketplace) ou o tamanho de página muda.

**Aplicado em:**
- `src/components/fiscal/InvoiceEditor.tsx` — `persistSave` chama `onOpenChange(false)` quando não há etapa encadeada.
- `src/components/fiscal/FiscalInvoiceList.tsx` — estado `pageSize`/`currentPage`, slice `pagedInvoices`, ref de linhas, destaque pós-save (`highlightedInvoiceId`) e rodapé de paginação.

### Hotfix 2026-05-19 — Aviso "Endereço incompatível com o CEP" não desaparecia após correção

**Problema.** Mesmo depois de o usuário corrigir a UF no Pedido de Venda (via "Salvar e atualizar cadastro"), o aviso amarelo de divergência entre UF e CEP continuava aparecendo na lista e dentro do pedido. O cadastro do cliente era atualizado corretamente, mas o aviso ficava "preso".

**Causa raiz.** O recálculo automático de pendências e avisos do Pedido de Venda rodava antes da gravação, mas consultava os próprios dados da tabela — que, naquele instante, ainda continham os valores antigos. Resultado: o aviso era recalculado com base no estado antigo e regravado idêntico, dando a impressão de que a correção não funcionou.

**Correção.** O recálculo de avisos e pendências passou a usar os valores novos que estão sendo gravados, não os antigos da tabela. Assim:
- Ao corrigir a UF (ou cidade) no pedido, o aviso some imediatamente.
- Se em uma edição futura a UF voltar a divergir do CEP, o aviso reaparece automaticamente.
- Não há mudança de UI, de regra de negócio nem de fluxo: continua sendo aviso (amarelo, não bloqueia emissão), conforme Hotfix 2026-05-18e.

**Limpeza retroativa.** Pedidos em aberto com avisos pendentes foram reavaliados após o ajuste; casos antigos onde a UF já estava correta (como o Pedido 1-75 — João Marcos / MT) tiveram o aviso removido automaticamente. Permaneceram apenas os casos com divergência real (ex.: UF gravada como "SAO PAULO" em vez de "SP"), que continuam pendentes de correção pelo lojista.

**Confirmação operacional.** O fluxo "Salvar e atualizar cadastro" continua propagando o endereço corrigido para o cadastro do cliente e para o Pedido de Venda fiscal. O pedido original (módulo Pedidos) permanece imutável após virar Pedido de Venda — comportamento intencional documentado neste mesmo documento.

**Lacuna conhecida (não bloqueante).** A consulta de listagem fiscal ainda traz todos os registros do tenant (até o teto de 1.000 do Supabase). A paginação real no servidor com `range()` fica como evolução futura quando algum tenant ultrapassar ~800 registros ativos — neste momento o ganho de UX já cobre o problema imediato e elimina o risco de scroll infinito.

**Validação técnica:**
- Build TypeScript limpo (`tsc --noEmit`) após as alterações.
- Tenant **Respeite o Homem** com 221 pedidos em aberto: paginação carrega corretamente; troca de filtro reseta para a página 1.
- Fluxo de edição: salvar pedido → editor fecha → lista rola até a linha salva com destaque azul por ~2,5s.
- Diálogo de sincronização do cadastro continua disparando quando o destinatário muda em campos comerciais (nome, CPF/CNPJ, contato, endereço); IBGE-only **não** dispara (validado nos logs: edição 17:39, pedido `4b709af9`).

---

## Hotfix 2026-05-20d — Gate de sincronização obrigatória do emitente antes de emitir/reenviar

**Problema.** A NF 1-289 do tenant *Respeite o Homem* ficou presa em rejeição
481 ("Código Regime Tributário do emitente diverge do cadastro na SEFAZ"),
mesmo após o usuário trocar o regime para **MEI / CRT 4** em Configurações
Fiscais e o sistema já gerar nova referência em cada reenvio (Hotfix 2026-05-20c).

**Causa raiz.** O fluxo de transmissão lia `fiscal_settings` local
(`updated_at = 05:50`, regime correto) mas não comparava com
`focus_ultima_sincronizacao = 05:07` no provedor. A NF era transmitida com o
cadastro do emitente defasado no Focus NFe → o provedor mandava o CRT antigo
para a SEFAZ → rejeição 481 real. Não era falha da nota, era falha de
sincronização do cadastro do emitente.

**Correção.** Criado helper compartilhado
`supabase/functions/_shared/fiscal-emitente-sync-gate.ts → ensureEmitenteSynced()`,
plugado em `fiscal-submit` e `fiscal-emit` logo após carregar `fiscal_settings`
e antes do `evaluateEmissionGate`.

Regra:
1. Se `focus_empresa_id` ainda não existir, `focus_ultima_sincronizacao` for nulo,
   ou `fiscal_settings.updated_at > focus_ultima_sincronizacao`, dispara
   `fiscal-sync-focus-nfe` automaticamente antes de transmitir.
2. Recarrega `fiscal_settings` e confirma que o snapshot externo avançou
   (`focus_ultima_sincronizacao >= updated_at`).
3. Se a sincronização falhar ou o snapshot não avançar, a transmissão é
   **bloqueada** com erro de negócio (`code: emitente_sync_failed` ou
   `emitente_sync_stale`). A NF não é enviada para a SEFAZ com cadastro defasado.

**Por que isso é estrutural, não remendo.**
- Cobre qualquer mudança fiscal (regime, CNAE, endereço, IE, nome empresarial)
  que ainda não tenha chegado ao provedor — não só MEI.
- Vale para emissão nova (`fiscal-emit`) e para reenvio de rejeitadas
  (`fiscal-submit`).
- Mantém a regra de nova `focus_ref` em retry de rejeitada (Hotfix 2026-05-20c)
  — as duas atuam juntas: o ref novo garante reavaliação na SEFAZ, o gate de
  sync garante que a SEFAZ recebe o cadastro atualizado.

**Anti-regressão.**
- Constraint registrada em `mem://constraints/fiscal-emitente-must-be-synced-before-emit`.
- Qualquer nova edge function que transmita NF-e deve chamar `ensureEmitenteSynced()`
  antes de montar o payload.
- Proibido criar botão de "forçar resync" na UI — o gate é automático e
  obrigatório no backend.

**Validação técnica.**
- Build TypeScript limpo após as alterações.
- Caso real: NF 1-289 (tenant `d1a4d0ed`), `fiscal_settings.updated_at = 05:50`,
  `focus_ultima_sincronizacao = 05:07`, rejeitada às 05:48 com motivo
  "Código Regime Tributário do emitente diverge". Próximo reenvio acionará o
  gate, sincronizará o emitente no Focus e só então transmitirá para a SEFAZ.

## Fase 2 — Visibilidade de e-mail, frase legal MEI/Simples e auto-emissão (v2026-05-20)

### 1. Rastreamento do envio de e-mail ao cliente
A NF-e agora registra, em colunas próprias na tabela `fiscal_invoices`, o resultado do último envio do e-mail com DANFE/XML:
- `email_sent_at` — data/hora do envio
- `email_sent_to` — endereço usado
- `email_send_status` — `sent` | `failed`
- `email_send_error` — motivo quando falha
- `email_provider_message_id` — ID retornado pelo SendGrid

O histórico cumulativo continua em `fiscal_invoice_events` (`email_sent` / `email_failed`) e em `system_email_logs`. O envio passa a ser auditável: a UI pode mostrar "Enviado em DD/MM HH:MM para cliente@x" ou "Falha: motivo".

### 2. Frase legal MEI / Simples Nacional no DANFE/XML
O builder Focus NFe (`_shared/focus-nfe-adapter.ts`) agora recebe o CRT do emitente e, quando `CRT = 1, 2 ou 4` (Simples / Simples Excesso / MEI), prefixa automaticamente no campo `informacoes_adicionais_contribuinte` (infCpl) a frase exigida pelo Art. 26 da LC 123/2006:

> "Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de ICMS, de ISS e de IPI."

Conteúdo adicional do usuário em "Informações Complementares" é preservado após a frase. Aplicado tanto em `fiscal-emit` quanto em `fiscal-submit`.

### 3. Auto-emissão end-to-end (gatilho único `ready_to_invoice`)

Atualizado: 2026-06-10.

A auto-emissão é controlada por um único campo em `fiscal_settings`:

- `emissao_automatica` (boolean) — ativa/desativa o disparo automático.

O gatilho é único: **NF-e é emitida automaticamente quando o pedido entra em `ready_to_invoice` (Pronto para emitir NF)** e tem vínculo com pedido real (loja ou marketplace). PV manual (sem `order_id`) **nunca** entra nesse fluxo.

A coluna `emitir_apos_status` continua na tabela por compatibilidade, mas o backend `fiscal-settings` força sempre o valor `'ready_to_invoice'` no save, e o motor `fiscal-auto-create-drafts` não lê mais essa coluna — usa `ready_to_invoice` direto. A opção legada `'paid'` foi removida da UI e normalizada no banco em 2026-06-10. Ver `mem://constraints/fiscal-auto-emit-respeita-status-configurado`.

**Fluxo:**

1. Pedido entra em `paid` → trigger SQL `enqueue_fiscal_draft` enfileira em `fiscal_draft_queue`.
2. `scheduler-tick` consome a fila e chama `fiscal-auto-create-drafts` em modo TRIGGER.
3. O rascunho de Pedido de Venda é criado sempre que o emissor está configurado (independe do toggle de auto-emit) — isso garante que o módulo Fiscal sempre tenha o rascunho disponível para ação manual.
4. **Decisão de emitir** acontece em seguida:
   - Se `emissao_automatica = true` E `order.status === 'ready_to_invoice'` → invoca `fiscal-emit` em fire-and-forget.
   - Caso contrário → rascunho permanece em `draft` aguardando o status ou ação manual.
5. **Transição posterior para `ready_to_invoice`**: o trigger re-enfileira o pedido; o consumidor detecta o rascunho já existente e dispara `fiscal-emit` no rascunho previamente criado (sem duplicar).

**Regras de segurança:**

- A chamada interna usa `service_role` + `tenant_id` no body; `fiscal-emit` aceita esse caminho dispensando RBAC humano (owner/admin), mantendo isolamento por tenant.
- Notas com pendências (faltando peso/NCM/endereço) caem em `rejected` ou permanecem `draft` e aparecem na Central de Execuções via cards "Emitir NF-e" e "Pendências emissão".
- Cancelamento manual e reenvio (com novo `ref`) continuam inalterados.
- Toggle desligado → nenhuma chamada externa ocorre. Não há cron parado consumindo recursos: o fluxo inteiro é event-driven a partir do gatilho de pedidos.
- Sem retroatividade: pedidos antigos já pagos antes da ativação do toggle não são reprocessados automaticamente.
- Fluxo manual (PV criado direto no módulo Fiscal sem vínculo a pedido) **não é afetado** — auto-emit e auto-remessa só atuam sobre PV com `order_id`.
- **Auto-remessa não tem transportadora padrão.** A transportadora vem sempre do próprio pedido (`orders.shipping_carrier`), definida pelo checkout ou pela integração do canal de venda. O motor `shipping-create-shipment` não lê mais `fiscal_settings.default_shipping_provider`. Override só é aceito como parâmetro explícito da chamada (uso humano).
- **Save blindado contra campos legados.** `fiscal-settings` mantém uma blacklist (`cfop_intrastadual`, `cfop_interestadual`, `default_shipping_provider`) que descarta silenciosamente esses campos do payload antes do `UPDATE`/`INSERT`. Toda coluna removida no futuro deve entrar nessa lista no mesmo PR — ver `mem://constraints/fiscal-settings-save-legacy-fields-blacklist`.

### Limite de massa
Operações em lote de DANFE/XML mantêm limite de 100 notas por execução. A emissão automática não tem teto (uma por pedido aprovado).


---

## Paridade Tela ↔ Banco no Editor de NF-e (universal)

Atualizado: 2026-05-24.

Toda aba do editor de NF-e (Geral, Destinatário, Itens, Valores, Pagamento, Transporte, Observações) é contrato bidirecional: o que aparece na tela é o que está salvo, e o que o usuário digita é o que vai para o banco. Nenhum campo pode "voltar ao default" após salvar e reabrir.

**Campos persistidos pelo salvamento de rascunho** (lista canônica):

- **Geral:** `tipo_nota` (classificação UI: saida, entrada, devolucao, complementar, transferencia, ajuste), `tipo_documento` (derivado de `tipo_nota`), `finalidade_emissao`, `natureza_operacao`, `serie`, `data_emissao`, `hora_saida`, `nfe_referenciada`, `indicador_presenca`, `informacoes_fisco`, `observacoes`.
- **Destinatário:** `dest_*` completos + `indicador_ie_dest`. `dest_consumidor_final` e `dest_tipo_pessoa` são derivados automaticamente do CPF/CNPJ digitado.
- **Itens:** todos os campos de `fiscal_invoice_items`, incluindo impostos por item (`icms_*`, `pis_*`, `cofins_*`, `cst`).
- **Valores:** totais de produtos, frete, desconto, total da nota e totais de impostos (`valor_bc_icms`, `valor_icms`, `valor_pis`, `valor_cofins`).
- **Pagamento:** `pagamento_indicador`, `pagamento_meio`, `pagamento_valor`.

**Regras derivadas:**

1. `tipo_documento` é sempre derivado de `tipo_nota` (entrada/devolução = 0; demais = 1). O usuário não escolhe `tpNF` diretamente.
2. `dest_consumidor_final` é derivado de `dest_cpf_cnpj` (PF=1, PJ=0), conforme regra SEFAZ.
3. **Totais de impostos (Opção B):** ao abrir/alterar itens, os totais são preenchidos pela soma dos itens. Se o usuário editar manualmente, a edição é respeitada e mantida no salvamento. Botão "Recalcular dos itens" reaplica a soma.
4. Para registros antigos sem `tipo_nota`, ele é derivado de `natureza_operacao` + `cfop` na abertura, preservando o comportamento histórico.

**Compatibilidade:** o editor é o único ponto de classificação UI (`tipo_nota`). A transmissão para a SEFAZ continua usando os campos canônicos (`tpNF`, `finNFe`, etc.).

**Critério de fechamento (universal):** qualquer ajuste em qualquer aba do editor exige o teste salvar → recarregar → reabrir → conferir que todos os campos voltaram como digitados. Sem esse teste, a entrega fica em "Pendente de validação".

---

## Aba Pagamento — Particularidades por Tipo de Nota (universal)

Atualizado: 2026-05-25.

A aba "Pagamento" do editor de NF-e segue a regra SEFAZ de obrigatoriedade do grupo `<pag>`. A exibição é condicional ao `tipo_nota`:

| Tipo de Nota | Aba Pagamento | Regra SEFAZ |
|---|---|---|
| Saída | **Visível** | Obrigatório informar tPag e valor. |
| Entrada | **Visível** | Pode usar tPag = 90 (Sem Pagamento) quando não houver operação financeira. |
| Devolução | **Visível** | Idem entrada; depende da operação. |
| Transferência | **Oculta** | SEFAZ classifica automaticamente como tPag = 90 (Sem Pagamento). Não há operação financeira entre filiais do mesmo CNPJ raiz. |
| Remessa | **Oculta** | Idem transferência. Remessa para industrialização, conserto, demonstração, etc. não tem pagamento. |

**Regra UI:** quando a aba está oculta, o sistema garante automaticamente que `pagamento_meio = '90'` na transmissão. Se o usuário trocar o tipo de nota enquanto estava na aba Pagamento, ele é redirecionado para a aba Geral.

**Anti-regressão:** ao adicionar novo `tipo_nota`, atualizar a lista de tipos sem pagamento neste documento e na lógica condicional do editor.

---

## Lista de Notas Fiscais — Filtro por Tipo (universal)

Atualizado: 2026-05-25.

A aba "Notas Fiscais" do módulo Fiscal possui filtro dedicado por **Tipo de Nota** (Saída, Entrada, Transferência, Remessa, Devolução, Todos os tipos).

**Padrão ao entrar na aba:** filtro = **Todos os tipos**. Todas as notas são listadas por padrão; o lojista pode filtrar por tipo específico quando necessário.

**Compatibilidade com registros antigos:** quando `tipo_nota` não está persistido (NFs anteriores ao backfill), o tipo é derivado em tempo real a partir de `natureza_operacao` + `cfop` + `tipo_documento` + `finalidade_emissao`, preservando a classificação histórica.

**Aba Pedidos de Venda:** não tem este filtro — pedido de venda é sempre considerado saída na regra de negócio.

---

## Pedido de Venda → Remessa (2026-05-27)

O Pedido de Venda Fiscal é a **origem oficial** do rascunho logístico. Ao criar um PV raiz (vindo de pedido aprovado, manual ou duplicado), o sistema enfileira automaticamente o rascunho de remessa correspondente.

- Duplicar um PV → cria um novo rascunho de remessa vinculado ao novo PV.
- Excluir um PV em rascunho → remove a remessa-rascunho vinculada, **sem tocar no pedido original**.
- PVs com NF autorizada ou etiqueta válida permanecem imutáveis (regras existentes mantidas).
- Pedidos via gateway e marketplaces seguem rotas próprias e não passam pela fila local.

Anti-regressão: ver `mem://constraints/shipping-draft-mirrors-pedido-venda`.

---

## Status do Pedido de Venda controla presença na fila de Remessas (2026-05-27)

A fila de **Remessas (Logística)** lista exatamente os Pedidos de Venda com status **"Pedido em aberto"** (e que não sejam via gateway de frete).

- Pedido de Venda sai de "em aberto" (chargeback, cancelamento, NF criada, concluído etc.) → some imediatamente da fila de Remessas (apenas rascunhos sem etiqueta).
- Pedido de Venda volta para "em aberto" → reaparece automaticamente na fila.
- Remessas com etiqueta já postada nunca são removidas — exigem tratamento manual.

Anti-regressão: ver `mem://constraints/shipment-mirrors-pedido-venda-em-aberto`.

---

## Busca e Ordenação das Listagens (Pedidos de Venda e Notas Fiscais)

**Atualizado em 2026-06-08.**

### Campo de busca
A caixa de busca (mesma nas duas abas) procura nos campos abaixo, **com normalização de acentos** (buscar "joao" encontra "João"):

| Campo | Critério |
|---|---|
| Número do PV / NF | substring |
| Nome do destinatário | substring, sem acento, case-insensível |
| CPF / CNPJ | só dígitos do termo digitado vs só dígitos do cadastro |
| E-mail | substring, sem acento |
| Telefone | só dígitos do termo vs só dígitos do cadastro |
| Chave de acesso da NF | substring |
| ID do pedido vinculado | substring |

Se o termo digitado não tiver dígitos, a busca por CPF/CNPJ e telefone é ignorada (não casa "tudo").

### Ordenação
Ambas as abas seguem o **Padrão de Ordenação de Listagens Operacionais** (ver `transversais/padroes-operacionais.md`): número decrescente, com data como desempate. PVs/NFs recriados por reconciliação aparecem no lugar numérico correto, não no topo.

## Numeração soberana da NF-e

Desde 2026-06-09, toda emissão de NF-e via Focus NFe envia **número e
série explícitos** no payload. O número que o lojista vê no painel é
exatamente o mesmo número que a SEFAZ autoriza e que é repassado para
o WMS Pratika e outros integradores logísticos. Não há mais divergência
entre o número interno e o número oficial.

### Regras

- **Tenants novos** começam em **1** tanto para Pedido de Venda quanto
  para Nota Fiscal, em cada série.
- **PV e NF têm sequências independentes** — duplicar PV ou NF avança
  apenas o cursor da própria classe. Números diferentes entre PV e NF
  do mesmo pedido são esperados; o vínculo é feito pelo campo
  `source_order_invoice_id`, nunca por igualdade de número.
- **Caminho B (auto-realinhamento)**: se a SEFAZ rejeitar com
  "número já utilizado", o sistema avança o cursor 1, registra a
  monotonicidade em `fiscal_settings.numero_nfe_atual` e tenta novamente
  com novo `ref` Focus, até 20 tentativas. O cursor nunca retrocede.
- **Cancelamentos/inutilizações na SEFAZ não liberam números** — uma vez queimado na SEFAZ (autorizado, rejeitado ou duplicado), o número fica para sempre marcado pelo cursor `numero_nfe_atual`.
- **Rascunho puro pode reusar número** (v2026-06-09 — Onda 3 rev2): NF rascunho que nunca tocou a SEFAZ (sem `chave_acesso` e sem eventos `submitted/authorized/rejected/submission_error/numero_duplicado_sefaz`) pode ser excluída e o número volta ao pool. PV em rascunho puro (sem NF emitida, sem objeto despachado e sem pedido pago ativo) também reaproveita o número.

### Onde mexer

- Detecção de duplicidade: `isDuplicateNumberError` em
  `supabase/functions/_shared/focus-nfe-adapter.ts` (cobre cStat 539/204
  e padrões textuais).
- Motor de envio: `fiscal-emit` (caminho principal) e `fiscal-submit`
  (caminho legado), ambos com retry loop e cap=20.

## Bloco transportador na NF-e

Toda NF-e de venda que tenha transportadora definida no pedido emite
com **bloco transporte completo**: razão social, CNPJ (quando conhecido),
inscrição estadual, endereço, município, UF, volumes (quantidade,
espécie, peso bruto/líquido) e modalidade de frete.

### Resolução da transportadora

O sistema cruza nome + serviço informados no pedido com o **catálogo
embutido** (`_shared/carrier-registry.ts`):

| Transportadora | CNPJ conhecido | Serviços reconhecidos |
|---|---|---|
| Correios | ✅ 34.028.316/0001-03 | PAC, SEDEX, SEDEX 10/12/HOJE, Mini Envios |
| Jadlog | — | Package, .Package, Econômico, Com, Rodoviário |
| Loggi | — | Express, Corp |
| Mercado Envios | — | Flex, Full, Collect |
| Shopee Xpress | — | SPX |
| Total Express | — | Prime, Econômico |
| Azul Cargo | — | Expresso, Amanhã, E-commerce |
| Braspress | — | Rodoviário, Aéreo |
| Rodonaves | — | RTE |
| Latam Cargo | — | Express |

Quando o nome não bate com nenhum registro, o sistema usa o nome bruto
do pedido e emite mesmo assim — o operador pode editar a NF antes de
mandar para a logística se for o caso (aviso opcional, não bloqueante).

### Modalidade de frete

| Situação | Modalidade SEFAZ |
|---|---|
| Frete cobrado do cliente | 1 (destinatário) |
| Frete grátis + transportadora definida | 0 (emitente absorve) + observação automática "Frete grátis — custo absorvido pelo emitente." |
| Sem transportadora e sem frete | 9 (sem frete) |

### Anti-regressão

Memória: `mem://constraints/nfe-numero-soberano-e-bloco-transportador`.
