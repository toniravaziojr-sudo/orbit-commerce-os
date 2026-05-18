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

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Fiscal.tsx` | Dashboard fiscal (abas: Pedidos em Aberto, Notas Fiscais). Botão "Configurações" navega para `/fiscal/configuracoes?from=fiscal` |
| `src/pages/FiscalSettings.tsx` | **Página dedicada** de Configurações Fiscais — 3 abas: Configurações Fiscais (emitente), Natureza Jurídica, Outros. Botão "Voltar" contextual via `?from=`. Acessada pelo módulo Fiscal. |
| `src/pages/SystemSettings.tsx` | **Casa oficial** das configurações (rev 2026-04-17c) — abas Pagamentos e Fiscal. A aba Fiscal renderiza os mesmos componentes (`EmitenteSettings`, `OperationNaturesContent`, `OutrosSettings`) embutidos, sem redirecionamento. URL: `/system/settings?tab=fiscal&aba=<emitente\|natureza\|outros>`. |
| `src/components/fiscal/settings/EmitenteSettings.tsx` | Aba Emitente — dados da empresa, endereço, regime tributário, certificado A1 |
| `src/components/fiscal/settings/OperationNaturesContent.tsx` | Aba Natureza Jurídica — gestão das naturezas de operação |
| `src/components/fiscal/settings/OutrosSettings.tsx` | Aba Outros — inutilização de numeração, automações de emissão/remessa/e-mail, desmembramento de kits |
| `src/pages/FiscalProductsConfig.tsx` | NCM/CFOP por produto |
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

Quando a configuração `desmembrar_estrutura` está ativa em `fiscal_settings`:

1. **Valores do Pedido**: Os valores são extraídos do pedido original (preço de venda real)
2. **Listagem na NF**: Os componentes são listados separadamente para facilitar conferência
3. **Rateio Proporcional**: O valor total do kit é distribuído proporcionalmente entre os componentes
4. **NCM por Componente**: Cada componente usa seu próprio NCM cadastrado em `fiscal_products`

**Fluxo:**
```
Kit vendido por R$ 100,00
├── Componente A (valor base R$ 60) → R$ 60,00 na NF
└── Componente B (valor base R$ 40) → R$ 40,00 na NF
                                     ────────────
                                      Total: R$ 100,00 (igual ao pedido)
```

**Importante:** A estrutura do produto (componentes e quantidades) é apenas para listagem na NF. Os preços/custos no cadastro do componente não afetam o valor final - o que vale é o preço vendido no pedido.

### Shared Module: Kit Unbundler
```typescript
// supabase/functions/_shared/kit-unbundler.ts
// Desmembra kits em componentes individuais
// Mantém rastreabilidade: original_kit_id, original_kit_name, is_from_kit
```

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

#### Status do piloto

- **Respeite o Homem** permanece em **homologação** durante o piloto. O token de produção da empresa só será cadastrado após validação completa em homologação. Não há emissão real de NF-e no piloto.

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
- Recebimento automático com `webhook_status = 'validated'` (já recebeu pelo menos uma confirmação real da Focus).

**Quando a ativação automática é tentada:**
- Ao chamar **"Validar integração fiscal"** no card.
- Ao salvar credenciais do tenant em "Credenciais do provedor fiscal" (próxima revalidação).
- Sempre que o card detectar `webhook_status` ausente/`error` com todos os pré-requisitos presentes.

A ativação automática reaproveita cadastro existente da Focus para o mesmo CNPJ/URL e nunca duplica hooks. Se houver hook antigo apontando para outra URL/token, ele é substituído com segurança.

**Selo geral do card (`overall_status`):**

| Status | Quando | Cor |
|--------|--------|-----|
| `ready` | Produção com tudo OK e webhook `validated` | verde — "Pronto" |
| `ready_for_test` | Homologação com empresa, certificado, token de homologação e webhook `pending`/`validated` | verde — "Pronto para teste" |
| `config_pending` | Falta uma ação objetiva do usuário (ex: token de homologação ausente) | âmbar — "Configuração pendente" |
| `error` | Falha real (cert vencido, falha remota da Focus, erro 401, falha na ativação) | vermelho — "Erro" |
| `blocked` | **Apenas** em produção quando recebimento automático ainda não está `validated` ou outro requisito obrigatório falta | vermelho — "Bloqueado" |

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
- `fiscal-emit` / `fiscal-submit` continuam bloqueados quando recebimento automático não está `validated`, certificado é inválido ou `focus_token_producao` está ausente. Esses gates já existem nas próprias funções; o card apenas reflete o estado.

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
   → 'authorized' | 'rejected' | 'denied'
6. nfe-shipment-link (helper) propaga o vínculo para shipments quando autorizada
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
4. **Anti-duplicação via índice único (v2026-05-13 — Onda 1.A)**: O índice parcial `idx_fiscal_invoices_order_unique` em `(tenant_id, order_id) WHERE status NOT IN ('cancelled', 'rejected') AND order_id IS NOT NULL` impede a criação de múltiplos rascunhos/NFs ativas para o mesmo pedido. Notas `cancelled` e `rejected` (rejeitadas pela Sefaz) **não contam como ativas**, permitindo re-rascunho e reemissão após esses cenários. Conflitos no índice são tratados como "registro já existente" (fetch do invoice existente), não como erro.

   **Status canônico (v2026-05-13 — Onda 1.A)**: Os valores hoje permitidos em `fiscal_invoices.status` pela CHECK constraint são `draft`, `pending`, `authorized`, `rejected`, `cancelled` (com 2 L's). A grafia `canceled` (1 L) está **bloqueada por CHECK constraint no banco** e foi migrada retroativamente para `cancelled`. Observação: o código fiscal também usa `processing` e `error` em fluxos auxiliares/legados, então a constraint ainda precisa ser saneada no próximo lote para alinhar banco e backend sem risco.

    **Duplicar Pedido de Venda / Duplicar NF (v2026-05-14 — Onda 2 rev1)**: A duplicação abre um diálogo pré-preenchido (`ManualInvoiceDialog` em `mode="duplicate"`) para o usuário revisar/editar antes de salvar; só ao clicar em **"Salvar duplicação"** o novo registro é criado.

### Status visual do Pedido de Venda (v2026-05-16 — Onda 2 rev2)

A aba **Pedidos de Venda** exibe agora 5 status derivados (não persistidos como coluna nova; calculados em `src/lib/fiscal/pedidoStatus.ts` a partir de `order_status`, `pendencia_motivos` e existência de NF filha autorizada via `source_order_invoice_id`):

| Status | Cor | Quando | Bloqueia emissão? |
|--------|-----|--------|-------------------|
| **Pedido em aberto** | Azul | Aprovado, sem pendências, sem NF emitida ainda | Não |
| **Pendente** | Amarelo | `pendencia_motivos` não vazio (trigger SQL `trg_recompute_pedido_venda_pendencias` mantém o array) | **Sim** — Criar NF e Declaração de Conteúdo ficam desabilitados; banner amarelo no editor lista os motivos |
| **Concluído** | Verde | Já existe ao menos uma NF filha autorizada (`status='authorized'` + `source_order_invoice_id = pedido.id`) | Não — ainda permite gerar NF complementar/devolução |
| **Cancelado** | Vermelho | `order_status IN ('cancelled', 'canceled')` | Sim |
| **Chargeback** | Vermelho | `order_status IN ('chargeback_detected', 'chargeback_lost')` | Sim |

- Filtros, cards de resumo (Em aberto / Pendente / Concluído) e badge da linha consomem a mesma fonte (`PEDIDO_STATUS_CONFIG`).
- Bloqueio é triplo: dropdown desabilita o item com tooltip explicativo; handler (`requestEmitInvoice`, `openDcDialogForInvoice`, `handleBulkSubmit`) rejeita com toast PT-BR; botão "Criar Nota Fiscal" dentro do editor fica desabilitado enquanto houver `pendenciaMotivos`.
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

    **Numeração monotônica (v2026-05-17 — Onda 3)**: Cada loja tem dois contadores independentes — `numero_pedido_atual` e `numero_nfe_atual` — em `fiscal_settings`. A numeração avança a cada criação (Pedido de Venda ou Nota Fiscal), **nunca recua** e **nunca reaproveita** números excluídos. Exemplo: estando no Pedido 181, o próximo é 182. Se o 182 for excluído, o próximo será 183 (o 182 fica como "hole" permanente). Isso vale para qualquer canal — manual, duplicação ou automação a partir de pagamento aprovado (loja, marketplaces). Índices únicos parciais em `fiscal_invoices` impedem colisões mesmo em corridas concorrentes. A numeração da NF-e é alocada **somente** no momento de "Criar Nota Fiscal", consumindo o cursor `numero_nfe_atual` (sequência SEFAZ-compliant), e é totalmente independente da numeração do Pedido.

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
  - **Autorizada + DANFE impressa** (`status='authorized'` + `danfe_printed_at IS NOT NULL`) — status azul + badge auxiliar verde **"Impressa"**
  - **Rejeitada** (`emitida` + `status='rejected'`) — vermelho
  - **Cancelada** (`emitida` + `status='cancelled'`) — vermelho
  - **Erro** (`status='error'`) — vermelho
- Botão principal: **"Nova NF-e"** → cria rascunho vazio com `fiscal_stage='pedido_venda'` e abre o **InvoiceEditor** (editor completo com 6 abas: Geral, Destinatário, Itens, Valores, Transporte, Pagamento).
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
- Naturezas são **filtradas automaticamente** conforme o tipo de nota selecionado (saída→vendas, entrada→compras, devolução→devoluções, remessa→remessas não faturadas, transferência→transferências)
- Ao selecionar uma natureza, os seguintes campos são preenchidos automaticamente: **CFOP** (`cfop_intra`), **Indicador de Presença** (`ind_pres`), **Consumidor Final** (`consumidor_final`)
- Ao trocar o tipo de nota, natureza e CFOP são **resetados** para forçar re-seleção coerente
- CFOP preenchido usa `cfop_intra` como padrão (intraestadual); o usuário pode alterar manualmente para `cfop_inter` se necessário
- 18 naturezas padrão pré-cadastradas cobrindo operações comuns de e-commerce (vendas, compras, devoluções, remessas, consignação, bonificação, transferência)
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
| Autorizada + DANFE impressa | azul + badge verde "Impressa" |
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
| `fiscal_invoices` | ✅ | SELECT/INSERT/UPDATE para membros do tenant; DELETE só de rascunho por owner/admin | tenant_id direto via `user_belongs_to_tenant` |
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
- **Simples Nacional**: PIS/COFINS/ICMS zerados, usa `csosn`. Apuração real via DAS.
- **Lucro Presumido / Real**: aplica `aliquota%` sobre o `valor_total` do item, usa `cst`. Precedência: override do produto → padrão do tenant → zero.

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
