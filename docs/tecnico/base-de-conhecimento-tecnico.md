# Base de Conhecimento Técnico — Comando Central

**Versão:** 1.0.0  
**Atualizado:** 2026-04-12  
**Objetivo:** Registrar problemas encontrados, soluções aplicadas, padrões proibidos, decisões arquiteturais e lições aprendidas em todas as camadas do sistema (UI/UX, fluxos, conexões, edge functions, prompts, banco de dados, etc).

> ⚠️ **Regra de uso:** Este documento DEVE ser consultado antes de qualquer ajuste, correção ou implementação que toque áreas já documentadas aqui. Se o problema ou padrão já está registrado, aplicar a solução conhecida — nunca repetir o erro.

---

## Índice

1. [UI/UX — React & Estado Local](#1-uiux--react--estado-local)
2. [Edge Functions — Deno / Supabase](#2-edge-functions--deno--supabase)
3. [Banco de Dados — Migrations & RLS](#3-banco-de-dados--migrations--rls)
4. [Pagamentos — Gateways & Checkout](#4-pagamentos--gateways--checkout)
5. [Integrações Externas — TikTok, Meta, etc](#5-integrações-externas)
6. [Prompts & IA](#6-prompts--ia)
7. [Padrões Proibidos (Anti-Patterns)](#7-padrões-proibidos-anti-patterns)
8. [Decisões Arquiteturais](#8-decisões-arquiteturais)
9. [Estabilização do Atendimento e Cérebro de IA (D6–D10)](#9-estabilização-do-atendimento-e-cérebro-de-ia-blocos-d6d10--2026-04-26)

---

## 1. UI/UX — React & Estado Local

### 1.1 useEffect em loop infinito por referência instável

**Problema:** `useEffect` que depende de array derivado (ex: `providers.filter(...)`) roda infinitamente porque `.filter()` cria nova referência a cada render, mesmo com os mesmos dados.

**Sintoma:** Campos da UI não respondem a cliques/mudanças — o estado local é resetado a cada render antes do usuário conseguir interagir.

**Causa raiz:** `activeProviders = providers.filter(p => p.is_enabled)` no corpo do componente gera nova referência → `useEffect([..., activeProviders])` dispara → reseta estado local → loop.

**Solução:**
1. Envolver derivações de array/objeto com `useMemo`:
   ```tsx
   const activeProviders = useMemo(() => providers.filter(p => p.is_enabled), [providers]);
   ```
2. Para efeitos de inicialização (carregar dados do DB uma única vez), usar `useRef` como flag — **mas o critério de bloqueio NÃO pode ser `data.length === 0`** (isso quebra tenant novo, ver seção 1.2). Use uma condição de "contexto pronto":
   ```tsx
   const initialized = useRef(false);
   useEffect(() => {
     if (initialized.current) return;
     // ❌ NÃO usar `if (data.length === 0) return;` — bloqueia tenant novo para sempre.
     // ✅ Use uma dependência funcional que indique "estou pronto para inicializar":
     if (!hasRequiredContext) return; // ex: provider ativo, tenant carregado
     initialized.current = true;
     // Merge: para cada item esperado, usar dado do banco se existir, senão default local.
   }, [data, hasRequiredContext]);
   ```

**Onde ocorreu:** `PaymentSettingsTab.tsx` — Configurações de Pagamento (abril/2026).

**Regra derivada:** Todo array/objeto criado no corpo de um componente e usado como dependência de `useEffect` DEVE ser memoizado com `useMemo`.

---

### 1.2 Guard de inicialização que bloqueia tenant novo

**Problema:** `useEffect` de inicialização que retorna cedo quando a fonte de dados vem vazia (`if (data.length === 0) return;`) impede a UI de renderizar para tenants novos, que legitimamente ainda não têm registros salvos.

**Sintoma:** Tela de configuração aparece "incompleta" para tenant novo (faltam cards, seções inteiras, campos não aparecem) mesmo com providers/integrações ativos. Tenants antigos funcionam normalmente porque já têm registros no banco.

**Causa raiz:** O guard confunde dois cenários distintos:
- "dados ainda chegando do banco" → legítimo aguardar
- "dados chegaram e estão vazios porque o tenant é novo" → **NÃO** deve aguardar, deve montar a UI com defaults locais

**Solução:** Trocar o critério do guard de "tem registro?" para "tenho contexto mínimo para inicializar?" (ex: provider ativo, tenant resolvido, integração configurada). Inicializar com merge entre dados reais do banco e defaults locais; o primeiro Save gera o upsert.

**Onde ocorreu:** `PaymentSettingsTab.tsx` — tenant Amazgan (abril/2026). A linha `if (allDiscounts.length === 0) return;` impedia a tela de mostrar cards de PIX/Cartão/Boleto, restando só o seletor de provider.

**Regra derivada:** Guards de `useEffect` de inicialização em telas de configuração de tenant **NUNCA** devem usar `length === 0` da fonte de dados como bloqueio. O critério correto é uma condição de "contexto mínimo resolvido". Esta regra é estrutural e está no Layer 2, seção 3.7.1.

---

## 2. Edge Functions — Deno / Supabase

### 2.1 Valores hardcoded vs configuráveis por tenant

**Problema:** Expiração de PIX (3600s) e Boleto (3 dias) estavam hardcoded nas edge functions `pagarme-create-charge` e `mercadopago-create-charge`, impedindo configuração por tenant.

**Solução:** Buscar valores da tabela `payment_method_discounts` (colunas `pix_expiration_minutes`, `boleto_expiration_days`, `free_installments`) dentro da edge function antes de montar o payload para o gateway.

**Regra derivada:** Nunca hardcodar valores que podem variar por tenant. Se o valor é configurável na UI, a edge function DEVE buscá-lo do banco.

### 2.2 Deploy falha com erro 500 — deno.lock incompatível

**Problema:** Edge functions falham no deploy com erro interno 500.

**Causa raiz:** `deno.lock` com formato incompatível com o edge-runtime, ou imports `esm.sh` com hash/redirect stale.

**Solução:**
1. Remover ou renomear `deno.lock` e tentar novamente
2. Preferir `npm:` specifiers em vez de `esm.sh` para estabilidade

### 2.3 platform-secrets-check não verificava credenciais novas

**Problema:** Após migrar de Focus NFe para Nuvem Fiscal, o Admin exibia "Não configurado" para o módulo Fiscal, apesar das credenciais estarem presentes no ambiente.

**Causa raiz:** A edge function `platform-secrets-check` não foi atualizada para verificar `NUVEM_FISCAL_CLIENT_ID` e `NUVEM_FISCAL_CLIENT_SECRET`. Ela ainda procurava pelas chaves antigas da Focus.

**Solução:** Atualizar `platform-secrets-check` para incluir as novas variáveis da Nuvem Fiscal na verificação.

**Regra derivada:** Ao migrar de provedor, atualizar todas as referências ao provedor antigo em edge functions utilitárias (health checks, secrets checks, dashboards).

### 2.4 Busca de clientes no Fiscal — campo e tabela errados

**Problema:** A busca de clientes no `ManualInvoiceDialog` não retornava resultados ao digitar nome, email ou CPF.

**Causa raiz:** (1) O filtro usava `name` em vez de `full_name` (nome real da coluna na tabela `customers`). (2) O endereço era buscado de colunas `address_*` inexistentes na tabela `customers`, em vez de vir da tabela `customer_addresses` via join.

**Solução:** Corrigir o campo para `full_name`, adicionar join com `customer_addresses` priorizando `is_default`, e filtrar `deleted_at IS NULL`.

**Regra derivada:** Sempre validar nomes de colunas contra o schema real antes de implementar queries. Endereços de clientes estão na tabela `customer_addresses`, nunca em `customers`.

### 2.5 Lógica duplicada no ManualInvoiceDialog (seletor "Importar de Pedido")

**Problema:** O dialog de criação de pedido manual continha um seletor "Importar de Pedido (opcional)" que duplicava a lógica de preenchimento, confundindo o fluxo.

**Solução:** Removido o seletor. O `ManualInvoiceDialog` é exclusivamente para criação manual — importação de pedidos existentes ocorre pelo fluxo automático (fila + cron).

**Regra derivada:** Cada dialog deve ter um único propósito claro. Não misturar criação manual com importação de dados existentes no mesmo formulário.

---

## 3. Banco de Dados — Migrations & RLS

### 3.1 CHECK constraints com funções não-imutáveis

**Problema:** `CHECK (expire_at > now())` falha na restauração do banco porque `now()` não é imutável.

**Solução:** Usar trigger de validação em vez de CHECK constraint para validações que envolvem tempo.

### 3.2 Nunca alterar schemas reservados do Supabase

**Schemas proibidos:** `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

Nunca criar triggers, functions ou alterar tabelas nesses schemas — causa degradação do serviço.

### 3.3 Limit padrão de 1000 rows

**Problema:** Queries que retornam mais de 1000 rows parecem ter "dados faltando".

**Solução:** Sempre paginar ou usar `.range()` quando o volume de dados pode exceder 1000.

### 3.4 Coluna ausente no schema vs edge function (PGRST204)

**Problema:** A edge function `fiscal-create-manual` incluía o campo `ambiente` no INSERT em `fiscal_invoices`, mas a coluna não existia na tabela. Erro: `Could not find the 'ambiente' column of 'fiscal_invoices' in the schema cache` (PGRST204).

**Causa raiz:** O campo `ambiente` existia em `fiscal_settings` mas nunca foi adicionado à tabela `fiscal_invoices`. A edge function assumia que existia.

**Solução:** Adicionada coluna `ambiente text DEFAULT 'homologacao'` em `fiscal_invoices` via migration (2026-04-14).

**Lição:** Ao adicionar campos no INSERT de uma edge function, sempre verificar se a coluna existe na tabela destino. Testar a criação de registros após qualquer alteração em edge functions fiscais.

---

## 4. Pagamentos — Gateways & Checkout

### 4.1 Expiração PIX — controle via API, não no dashboard do gateway

**Fato técnico:** Tanto Pagar.me (`expires_at` / `expires_in`) quanto Mercado Pago (`date_of_expiration`) controlam expiração do PIX **por transação via API**. Não existe configuração global no dashboard do gateway.

**Limites:**
| Gateway | PIX mín | PIX máx | Boleto máx |
|---------|---------|---------|------------|
| Pagar.me | ~5 min | ~24h (flexível) | ~30 dias |
| Mercado Pago | 30 min | 30 dias | ~30 dias |

**Campo no MP:** `date_of_expiration` (ISO 8601 com timezone)  
**Campo na Pagar.me:** `expires_in` (segundos) ou `expires_at` (timestamp)

### 4.2 Parcelamento — 100% via API

**Fato técnico:** Parcelas máximas e parcelas sem juros são controlados via API em ambos os gateways. O cliente/lojista NÃO precisa configurar nada no dashboard do gateway — o sistema define tudo.

**Pagar.me:** `installments`, `free_installments`  
**Mercado Pago:** `installments`, `installments_cost`, limite via regras da conta

### 4.3 Cartão de crédito — não tem "expiração" como PIX/Boleto

A autorização de cartão expira em ~5-7 dias se não capturada (padrão de adquirente, não do gateway).

### 4.4 free_installments — campo obrigatório no hook público de descontos

**Problema:** O hook `usePublicPaymentDiscounts` não incluía o campo `free_installments` na query, fazendo com que o checkout exibisse "sem juros" em todas as parcelas e a descrição do cartão fosse sempre "Em até 12x sem juros", independente da configuração real.

**Causa raiz:** O campo foi implementado na tabela e no hook admin (`usePaymentMethodDiscounts`), mas não no hook público que alimenta o checkout da loja. A descrição do `PaymentMethodSelector` era estática (hardcoded).

**Solução:**
1. Adicionado `free_installments` na query e interface do `usePublicPaymentDiscounts`
2. Criada função `getFreeInstallments()` no hook
3. Label de parcelas agora mostra "sem juros" até o limite configurado e "com juros" acima
4. Descrição do `PaymentMethodSelector` é dinâmica (baseada em `freeInstallments`, `maxInstallments` e `pixDiscountPercent`)

**Anti-pattern:** Nunca adicionar campos de configuração na tabela e no admin sem propagar para o hook público/storefront correspondente.

### 4.5 Checkout Links — processamento de parâmetros de URL

**Problema:** Os links de checkout (direto de produto `?product=slug` e personalizado `?link=slug`) geravam URLs corretas, mas o checkout não processava esses parâmetros. O carrinho chegava vazio e o usuário via a mensagem "Seu carrinho está vazio".

**Causa raiz:** A funcionalidade de geração de URLs foi implementada (no `ProductList` e `CheckoutLinkList`), mas o lado receptor — o processamento dos query params no checkout — nunca foi implementado. Nenhum código lia `?product=` ou `?link=` para adicionar produtos ao carrinho.

**Solução:**
1. Criado hook `useCheckoutLinkLoader` que:
   - Lê `?product={slug}&qty={n}` para link direto de produto
   - Lê `?link={slug}` para link personalizado com overrides
   - Busca produto(s) no banco, limpa o carrinho e adiciona os itens
   - Aplica cupom automaticamente (se configurado no link)
   - Suporta preço override e frete fixo/grátis
   - Carrega produtos adicionais (venda cruzada)
   - Incrementa click_count do checkout link
2. Integrado no `CheckoutStepWizard` com guarda de loading
3. Adicionada RLS pública (anon SELECT) para `checkout_links` ativos e não expirados
4. Frete override aplicado diretamente na etapa de cálculo de frete

**Onde ocorreu:** `src/hooks/useCheckoutLinkLoader.ts` (novo), `src/components/storefront/checkout/CheckoutStepWizard.tsx`

**Regra derivada:** Sempre que criar uma funcionalidade que gera URLs com parâmetros, implementar simultaneamente o processamento desses parâmetros no destino. Nunca deixar o "lado emissor" sem o "lado receptor".

---

## 5. Integrações Externas

### 5.1 TikTok — Tabelas separadas para Ads e Shop

**Decisão:** `tiktok_ads_connections` e `tiktok_shop_connections` são tabelas separadas com hooks separados (`useTikTokAdsConnection` e `useTikTokShopConnection`), pois possuem escopos OAuth, campos e fluxos distintos.

### 5.2 OAuth popup — Listener de mensagem

**Padrão:** Fluxos OAuth abrem popup → popup envia `window.postMessage` ao concluir → hook no componente pai escuta e invalida queries.

```tsx
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'provider:connected') {
      queryClient.invalidateQueries({ queryKey: ['connection-key'] });
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, [queryClient]);
```

---

## 6. Prompts & IA

### 6.1 Memória automática — nunca memorizar diagnósticos da IA

**Regra:** A função `ai-memory-manager` proíbe memorização automática de diagnósticos técnicos, estados de sistema ou recomendações geradas pela própria IA. Só capturar fatos e preferências explicitamente declarados pelo usuário.

**Motivo:** Evitar contaminação por alucinações (ex: diagnóstico incorreto de "pixel quebrado" ser tratado como fato em sessões futuras).

---

## 7. Padrões Proibidos (Anti-Patterns)

| # | Anti-Pattern | Por quê | Fazer em vez disso |
|---|-------------|---------|-------------------|
| 1 | Array/objeto derivado como dep de useEffect sem memo | Loop infinito, UI não responde | `useMemo` ou `useRef` flag |
| 2 | Hardcodar valores tenant-specific em edge functions | Impede configuração por lojista | Buscar do banco |
| 3 | CHECK constraint com `now()` | Falha na restauração | Trigger de validação |
| 4 | Alterar schemas reservados (auth, storage, etc) | Degradação do serviço | Criar no schema `public` |
| 5 | Cron como fluxo primário | Latência, fragilidade | Trigger/evento como primário, cron como fallback |
| 6 | `useEffect` de inicialização sem guard | Reset contínuo do estado | `useRef` flag para rodar uma vez |
| 7 | Criar solução específica por tenant | Quebra multi-tenancy | Solução genérica parametrizada |
| 8 | Memorizar diagnósticos de IA automaticamente | Contaminação por alucinação | Só memorizar fatos explícitos do usuário |

---

## 8. Decisões Arquiteturais

### 8.1 Tabela `payment_method_discounts` como fonte unificada

**Decisão:** Centralizar descontos, configurações de parcelas E configurações de expiração na mesma tabela, scoped por `tenant_id + provider + payment_method`. Colunas: `discount_type`, `discount_value`, `installments_max`, `installments_min_value_cents`, `free_installments`, `pix_expiration_minutes`, `boleto_expiration_days`.

**Motivo:** Evitar proliferação de tabelas de configuração por método. Um upsert resolve tudo.

### 8.2 Separação Billing SaaS vs Vendas do Lojista

**Decisão:** Faturamento da plataforma e processamento de vendas dos lojistas usam credenciais, interfaces e fluxos completamente isolados, mesmo quando o provider é o mesmo (ex: Mercado Pago).

### 8.3 Gateway map independente dos descontos

**Decisão:** `payment_method_gateway_map` define qual provider processa cada método. `payment_method_discounts` define configurações por provider+método. São tabelas separadas porque o mapeamento pode mudar sem afetar as configs.

### 8.4 Fluxos de campanha separados por módulo (Blog vs Mídia Social)

**Decisão:** Blog e Mídias Sociais (Facebook/Instagram) usam fluxos de criação separados no `PublicationDialog`, com prop `campaignType` controlando quais opções aparecem. Um não deve conter o outro.

**Motivo:** Evitar confusão do usuário ao ver opções irrelevantes (ex: escolher plataforma social ao criar post de blog).

### 8.5 Integrações de logística — modelo híbrido vs direto

**Decisão arquitetural:**
- **Loggi:** Modelo híbrido — credenciais OAuth2 globais no Admin, `company_id` por tenant
- **Correios:** Modelo direto — cada tenant configura suas credenciais OAuth2 (contrato próprio com os Correios)
- **Frenet:** Agregador — funciona como gateway multi-transportadora, token por tenant

---

## 9. WhatsApp & Meta — Lições de Integração

### 9.1 Webhook não recebe mensagens reais (só testes internos)

**Problema:** Mensagens enviadas para o número do WhatsApp não chegavam ao sistema (um traço só), mas testes internos do Meta funcionavam.

**Causa raiz (múltipla):**
1. Cloudflare Worker desatualizado — não continha a rota `/meta/whatsapp-webhook`
2. Número ainda registrado no app WhatsApp Business do celular — impede recebimento via API
3. WABA errado — o App no Meta Developer Portal estava vinculado a um WABA de teste, não ao de produção
4. Token gerado com User Token em vez de System User Token

**Solução (sequencial):**
1. Atualizar Cloudflare Worker com a rota correta
2. Remover número do app WhatsApp Business no celular
3. Vincular o WABA correto (produção) ao App
4. Gerar System User Token com assets corretos atribuídos
5. Assinar o campo "messages" no webhook do Meta Developer Portal

**Regras derivadas:**
- Sempre usar **System User Token** (não expira a cada 60 dias)
- Verificar se o Cloudflare Worker está sincronizado com as rotas do sistema
- Confirmar que o número foi removido do app mobile antes de testar API
- WABA de teste ≠ WABA de produção — nunca misturar

### 9.2 "Object with ID does not exist" no Meta

**Problema:** Erro ao tentar gerar token ou fazer chamadas API para o número.

**Causa raiz:** O Phone Number ID pertence a um WABA diferente do que está configurado no sistema/app. Gerar token em um WABA de teste não dá acesso a números de um WABA de produção.

**Solução:** Atualizar IDs no banco (`whatsapp_configs`) para refletir o WABA e Phone Number ID corretos da produção.

### 9.3 Drift entre `whatsapp_configs.connection_status` e estado real na Meta (v2026-04-19)

**Problema:** Tenant `respeiteohomem` tinha `connection_status='connected'` e PIN salvo, mas a Meta retornava `can_send_message: BLOCKED` e o número aparecia "Pendente" no WhatsApp Manager. Mensagens de teste falhavam silenciosamente. O botão "Salvar PIN" salvava o PIN mas não disparava o registro do número (porque o banco já dizia "connected").

**Causa raiz:**
1. O registro automático no callback do Embedded Signup falhou silenciosamente (provavelmente token ainda propagando ou WABA não-aprovada).
2. O `connection_status` foi marcado `connected` pelo callback otimista, sem validar com a Meta.
3. A função `meta-whatsapp-set-pin` confiava no `connection_status` do banco para decidir se precisava registrar — então PIN era salvo e nada mais acontecia.
4. O cron `meta-whatsapp-monitor-all` não auto-reparava `register_phone` por design (exigia ação manual).

**Solução implementada:**
1. **`meta-whatsapp-set-pin` agora probeia a Meta:** após salvar o PIN, faz `GET /{phone_id}?fields=status,code_verification_status`. Se Meta diz não-verificado, força `register_phone` mesmo que o banco diga "connected".
2. **`meta-whatsapp-monitor-all` agora auto-registra:** se `register_pin` está salvo (= consentimento prévio do usuário) E o diagnose detectar `NUMBER_NOT_REGISTERED`, executa `register_phone` automaticamente. Sem PIN salvo → apenas marca para ação humana.

**Regras derivadas (anti-regressão universal):**
- **Meta é a fonte de verdade do estado do número.** `connection_status` no banco é cache local e PODE divergir.
- **Nunca decidir sobre registro só com base no banco** — sempre validar Graph API antes de tomar decisão de escrita.
- **PIN salvo = consentimento explícito.** Cron pode auto-registrar sem perguntar de novo (auditoria preservada via `audit_log` original).
- **Salvar PIN deve produzir efeito visível:** se número não está realmente conectado, o ato de salvar PIN deve disparar registro automático na mesma ação (não deixar para próxima execução do cron).
- Toda nova função que tomar decisão sobre estado do WhatsApp deve seguir esse padrão: validar Meta → decidir → escrever.

---

## 10. Storefront & Builder — Lições de UI

### 10.1 Overlay escurecendo banner mesmo com opacidade zero

**Problema:** Banners de categoria ficavam escurecidos mesmo após setar `overlayOpacity: 0` no código.

**Causa raiz:** Templates existentes no banco de dados ainda continham `overlayOpacity: 40` (valor antigo), que sobrescrevia o novo default.

**Solução:** Forçar `overlayOpacity = 0` no componente `CategoryBannerBlock.tsx`, ignorando o valor vindo do template. Atualizar defaults em todos os pontos de configuração do builder.

**Regra derivada:** Ao mudar defaults de componentes do builder, verificar se templates já salvos no banco contêm valores antigos que sobrescreverão o novo default. Considerar migration de dados ou force-override no componente.

### 10.2 Footer para de renderizar menus

**Problema:** Menus do footer sumiram da loja pública, embora o builder mostrasse dados demonstrativos.

**Causa raiz:** Um `.limit(5)` na query de categorias impedia categorias além da 5ª de aparecerem, e links de menu dependiam dessas categorias.

**Solução:** Remover o `.limit(5)` da query e adicionar aviso visual quando menus estão configurados mas não renderizam.

**Regra derivada:** Nunca limitar queries de menu/navegação com `.limit()` arbitrário — menus devem trazer todos os itens configurados.

### 10.3 Categorias criadas manualmente sem miniatura

**Problema:** Categorias importadas tinham thumbnail, mas as criadas manualmente não.

**Causa raiz:** O formulário de criação de categoria não tinha campo de upload para `image_url`.

**Solução:** Adicionar campo de upload "Miniatura" no `CategoryForm.tsx`.

**Regra derivada:** Ao criar formulário para entidade que tem campo de imagem no banco, sempre incluir o campo de upload na UI.

### 10.4 Vitrine de produtos vazia no domínio público (ProductShowcase)

**Problema:** Após consolidar `ProductGrid` / `ProductCarousel` / `FeaturedProducts` / `CollectionSection` no orquestrador `ProductShowcase`, o bloco renderizava perfeitamente no Builder (que faz fetch via React Query no cliente) mas aparecia **vazio** no domínio publicado.

**Causa raiz:** O renderizador Edge (`storefront-html`) é data-blind — cada compiler de bloco roda síncrono e só lê de `compilerContext.products`. A função `extractProductIds` só reconhecia o tipo legado `FeaturedProducts` e não havia mecanismo para pré-buscar produtos de fontes dinâmicas (`featured`, `newest`, `all`, `category`). Resultado: nenhum produto era pré-carregado para `ProductShowcase`.

**Solução:**
1. Atualizado `extractProductIds` para reconhecer `ProductShowcase` quando `source === 'manual'` (mantendo `FeaturedProducts` como alias).
2. Criado `extractProductFetchSpecs` que coleta specs `{source, categoryId, limit}` de todos os blocos de vitrine (incluindo aliases legados `ProductGrid`, `ProductCarousel`, `CollectionSection`, `BannerProducts`).
3. Orquestrador `storefront-html` executa as queries dinâmicas e popula `context.products` / `context.productImages` antes de chamar `compileBlockTree`.

**Onde ocorreu:** `supabase/functions/_shared/block-compiler/index.ts`, `supabase/functions/storefront-html/index.ts`.

**Regra derivada:** **Todo bloco de vitrine novo ou renomeado precisa ser registrado nos sets `MANUAL_PRODUCT_ID_BLOCKS` / `DYNAMIC_PRODUCT_FETCH_BLOCKS` (ou em `extractCategoryIds`).** Compilers de bloco são proibidos de fazer fetch direto — toda I/O acontece no orquestrador `storefront-html`. Aliases legados não podem ser removidos dos extractors sem migração de dados (templates antigos quebram). Contrato formal em `docs/especificacoes/storefront/builder.md` › "Pipeline de Pré-busca de Dados (Edge)" e mapa em `docs/especificacoes/transversais/paridade-builder-publico.md` › "Pré-busca de dados".

### 10.5 Bloco "piscando" (loop loading) no Builder após consolidação

**Problema:** Após consolidar blocos em orquestradores (`CategoryShowcase`, `ProductShowcase`, `Highlights`, `Video`, `SocialProof`, `ContentSection`, `NewsletterUnified`, `CustomCode`), o bloco `CategoryShowcase` exibia loop infinito de "loading → render → remount" no canvas do Builder. No domínio público (Edge) o bug não aparecia.

**Causa raiz:** No registry `getBlockComponent` (`src/components/builder/BlockRenderer.tsx`), os 8 orquestradores estavam registrados como **arrow functions inline**: `CategoryShowcase: (props: any) => <CategoryShowcaseBlockComponent {...props} />`. A cada render do componente pai, uma nova função era criada → React tratava como componente diferente → desmontava e remontava a subárvore → `useState`/`useEffect` resetavam → fetch interno disparava de novo → loop visual.

**Solução:** Trocar por **referências diretas** ao componente: `CategoryShowcase: CategoryShowcaseBlockComponent`. Identidade estável → React reconcilia normalmente → estado interno preservado → fetch único.

**Onde ocorreu:** `src/components/builder/BlockRenderer.tsx` (8 entradas em "Unified blocks").

**Regra derivada:** **Todo bloco registrado em `getBlockComponent` deve ser uma referência direta ao componente, NUNCA arrow function inline.** Wrappers só são permitidos quando há transformação real de props (ex: `OrderBumpSlot`, `CrossSellSlot`) — e mesmo nesses casos, o wrapper deve ser declarado fora do `getBlockComponent` (módulo ou `useMemo`) para preservar identidade. Padrão consolidado em `mem://infrastructure/builder/modular-block-architecture-standard`.

### 10.6 "Vitrine de Categorias" (variante circular) re-renderizando ao selecionar outros blocos

**Problema:** Mesmo após o ajuste 10.5 (referências diretas no registry), o bloco `CategoryShowcase` em modo `circles` ainda exibia flicker de "loading" toda vez que o usuário clicava em qualquer outro bloco do canvas do Builder.

**Causa raiz:** O componente `FeaturedCategoriesBlock` original concentrava 4 responsabilidades (normalização de props, fetch manual via `useEffect` sem cache, lógica responsiva e instância do Embla). A dependência `[JSON.stringify(normalizedItems)]` no `useEffect`, combinada com a ausência de cache e com o `useEmblaCarousel` recebendo opções recriadas a cada render, fazia com que qualquer re-render do canvas (disparado por seleção em outros blocos) reiniciasse o ciclo `loading → fetch → render`.

**Solução:** Refatoração modular SRP em `src/components/builder/blocks/category-showcase/circles/`:
- `normalizeItems.ts` — normalização pura (sem efeitos).
- `useCategoriesData.ts` — fetch via React Query (cache 5min, key determinística pelos IDs).
- `CategoryCard.tsx` — card unitário memoizado.
- `GridLayout.tsx` / `CarouselLayout.tsx` / `DemoLayout.tsx` — layouts isolados e memoizados.
- `CirclesVariantBlock.tsx` — orquestrador puro (composição).
- `FeaturedCategoriesBlock.tsx` — shim de compatibilidade reexportando o novo módulo.

**Onde ocorreu:** `src/components/builder/blocks/FeaturedCategoriesBlock.tsx` (monolítico, removido) e `category-showcase/CategoryShowcaseBlock.tsx` (passou a importar `CirclesVariantBlock`).

**Regra derivada:** **Blocos do Builder que fazem fetch de dados devem usar React Query (ou outro cache estável), NUNCA `useEffect + useState + supabase` direto.** Re-renders do canvas são frequentes e esperados; sem cache, o ciclo loading reseta visualmente. Cada bloco complexo deve ser decomposto em: (1) normalização de props (puro), (2) hook de dados (com cache), (3) componentes de layout memoizados, (4) orquestrador. Padrão consolidado em `mem://infrastructure/builder/modular-block-architecture-standard`.

---

## 11. Frete & Logística

### 11.1 Fretes aparecendo com valor zero

**Problema:** Opções de frete (PAC, Sedex, Loggi) apareciam mas com preço R$ 0,00.

**Causa raiz:** Das 3 integrações configuradas (Frenet, Correios, Loggi), apenas Frenet estava funcional. Correios falhava com 401 (credenciais OAuth2 expiradas) e Loggi falhava por payload incompleto (faltava endereço completo no formato `correiosAddress`).

**Solução:** Corrigir payload da Loggi, renovar credenciais Correios, e exibir alertas quando provedores de frete falham silenciosamente.

**Regra derivada:** Edge functions de cotação de frete devem logar claramente quando um provedor falha, em vez de retornar silenciosamente R$ 0,00.

---

### 11.2 Frenet retornando zero opções — unidade de peso errada (regressão)

**Problema:** O checkout mostrava "Frete padrão (fallback)" a R$ 15,00 em vez das opções reais de transportadora (PAC, SEDEX, etc.). A Central de Execuções não exibia nenhum alerta.

**Causa raiz:** O agregador `shipping-quote` calcula peso internamente em **gramas** (300g mínimo) para compatibilidade com a API dos Correios. Porém, o adaptador do Frenet enviava esse valor diretamente no campo `Weight`, que a API do Frenet espera em **quilogramas**. Resultado: 300 KG era rejeitado silenciosamente pela API.

**Por que era invisível:** (1) O adaptador do Frenet no agregador não logava a resposta da API, impossibilitando diagnóstico. (2) O label de fallback continha "(fallback)" — termo técnico que vazou para o cliente. (3) A auto-detecção de provider (`shipping_providers → multi`) funcionava corretamente, mascarando o problema como se fosse do banco.

**Solução:** (1) Converter gramas para KG no adaptador Frenet: `Weight: totals.weight / 1000`. (2) Adicionar log da resposta da API Frenet. (3) Remover "(fallback)" dos labels visíveis ao cliente.

**Regra derivada:** Ao integrar APIs de terceiros que esperam unidades específicas, sempre documentar e converter explicitamente na camada do adaptador. Nunca assumir que a unidade interna do agregador é compatível. Sempre logar respostas de APIs externas para diagnóstico.

**Função legada de referência:** `frenet-quote/index.ts` usava 0.3 KG corretamente. A migração para o agregador `shipping-quote` não preservou a conversão de unidade.

---

### 1.5 Geração de imagens de produto — contrato assíncrono ignorado

**Problema:** Ao clicar "Gerar Imagens com IA" no cadastro de produto, o toast mostrava "Nenhuma imagem foi gerada" mesmo com o motor de IA gerando a imagem com sucesso no backend.

**Causa raiz:** O `AIImageGeneratorDialog` tratava a resposta da edge function `creative-image-generate` como **síncrona** — esperava `images[]` ou `image_url` na resposta imediata. Porém, a função foi evoluída para um pipeline **assíncrono**: retorna HTTP 202 com `job_id` + `status: running`, processa em background via `EdgeRuntime.waitUntil`, e salva os resultados em `creative_jobs.output_urls` ao terminar. O frontend não fazia polling do job e nunca recebia as URLs geradas.

**Evidência:** Consulta ao banco confirmou job `succeeded` com `output_urls` preenchidas, mas nenhuma nova linha em `product_images` vinculada.

**Solução:** Reescrita do `AIImageGeneratorDialog` para o padrão assíncrono:
1. Submete o job normalmente
2. Faz **polling** na tabela `creative_jobs` a cada 4s (timeout 5 min) verificando `status`
3. Quando `succeeded`, lê `output_urls` e insere cada URL em `product_images`
4. Feedback visual com barra de progresso e mensagens de fase (`submitting` → `polling` → `saving` → `done`)
5. Cancelamento limpo ao fechar o dialog

**Onde ocorreu:** `src/components/products/AIImageGeneratorDialog.tsx`

**Regra derivada:** Todo fluxo que consume uma edge function com processamento em background (retorno 202 + job_id) DEVE implementar polling no lado do cliente. Nunca assumir que o resultado estará na resposta imediata sem verificar o contrato da função. Pattern: "submit → poll → reconcile".

### 3.5 Naturezas de operação dinâmicas no InvoiceEditor

**Problema:** O editor de NF-e usava uma lista fixa de 6 naturezas de operação (strings hardcoded), desconectada do cadastro real em `fiscal_operation_natures`. O CFOP era preenchido manualmente.

**Causa raiz:** Implementação inicial usou array estático `NATUREZA_OPTIONS` em vez de consultar o banco.

**Solução:**  
1. Substituído `NATUREZA_OPTIONS` por consulta dinâmica à tabela `fiscal_operation_natures` filtrada por tenant e status ativo  
2. Ao selecionar uma natureza, CFOP, indicador de presença e consumidor final são preenchidos automaticamente  
3. Ao trocar o tipo de nota, natureza e CFOP são resetados para forçar re-seleção  
4. Expandido `DEFAULT_NATURES` de 10 para 18 naturezas comuns de e-commerce  
5. Naturezas filtradas conforme tipo de nota selecionado (saída, entrada, devolução, remessa, transferência)

**Onde ocorreu:** `src/components/fiscal/InvoiceEditor.tsx`, `src/pages/OperationNaturesSettings.tsx`

**Regra derivada:** Nunca usar listas fixas em componentes fiscais quando existe tabela de configuração no banco. Sempre buscar da fonte de verdade (`fiscal_operation_natures`) e propagar dados automaticamente.



### 3.6 Auxiliar de Comando v4.0.0 — Correções de Schema em Tools de Escrita (Abril/2026)

**Problema:** 16 tools de escrita do Auxiliar de Comando referenciavam colunas inexistentes ou usavam lógica incompatível com o schema real do banco, causando falhas silenciosas ou erros 500.

**Causa raiz:** As tools foram implementadas com nomes de colunas presumidos sem validação contra o schema real das tabelas.

**Correções aplicadas (command-assistant-execute/index.ts):**

| Tool | Coluna errada | Coluna correta | Observação |
|------|--------------|----------------|------------|
| bulkUpdateProductsNCM | `ncm_code` | `ncm` | — |
| bulkUpdateProductsCEST | `cest_code` | `cest` | — |
| deleteProducts | `DELETE FROM` | `UPDATE ... SET deleted_at` | Soft-delete obrigatório |
| createProduct | `ncm_code`, `cest_code` | `ncm`, `cest` | — |
| updateProduct | `ncm_code`, `cest_code` | `ncm`, `cest` | — |
| addOrderNote | `notes` | `internal_notes` | — |
| updateOrderTracking | `tracking_code` | já correto | Verificado OK |
| createManualOrder | `source` | `source_platform` | — |
| createCustomer | `name` | `full_name` | — |
| updateCustomer | `name` | `full_name` | — |
| createDiscount | `usage_limit`, `value/100` | `usage_limit_total`, valor direto em reais | Valores já em reais, não centavos |
| updateDiscount | `usage_limit`, `value/100` | `usage_limit_total`, valor direto em reais | Idem |
| createCampaign | desestruturação de `analytics` | campos diretos no insert | Tabela não tem coluna `analytics` |
| approveReview | `is_approved` | `status = 'approved'` | — |
| replyToReview | `response` (coluna separada) | concatenar em `content` | Tabela não tem coluna `response` |
| createPage | `content` | `html_content` | — |
| updatePage | `content` | `html_content` | — |

**Onde ocorreu:** `supabase/functions/command-assistant-execute/index.ts`

**Regra derivada:** Toda nova tool do Auxiliar de Comando DEVE ser validada contra o schema real (`types.ts` ou consulta SQL) antes do deploy. Nunca presumir nomes de colunas. Usar soft-delete (`deleted_at`) para produtos. Valores monetários em `discounts` são em reais (não centavos).

---

### 3.7 Auxiliar de Comando v4.0.0 — Tools de Leitura com Colunas Inexistentes

**Problema:** Algumas tools de leitura referenciavam colunas que não existem nas tabelas, retornando `null` para campos esperados ou causando erros.

**Correções aplicadas:**
- `listPotentialCustomers`: usava `total` (inexistente) → corrigido para `total_estimated`
- `listProductVariants`: validação de UUID adicionada para evitar queries com IDs inválidos

**Regra derivada:** Mesmo tools de leitura devem ser validadas contra o schema. Campos de agregação (`count`, `total`) devem usar os nomes exatos da tabela.

---

## 9. Storefront — Cache de Pré-Render & Registro de Compilers

### 9.1 Bloco some da loja pública após mudança no registry de compilers (Abril/2026)

**Problema:** Após refatorar o `FeaturedCategoriesBlock` (variante Circles) para arquitetura modular SRP e revalidar o builder, o bloco **ProductShowcase** parou de aparecer na vitrine pública (domínio final), mesmo estando presente no template publicado e renderizando corretamente no Builder.

**Sintoma visível:**
- Builder mostra o bloco renderizado normalmente.
- HTML final servido pelo Edge (`storefront-html`) **não contém** marcadores `data-product-id` nem classes `sf-fp-…`.
- `?_revalidate=1` não resolve — o problema persiste.
- Apenas tenants com vitrines acessadas recentemente são afetados (cache quente).

**Causa raiz (estrutural):**
1. O renderizador Edge `storefront-html` opera em modo **prerender-first**: a primeira requisição compila o HTML completo e persiste em `public.storefront_prerendered_pages` com `status = 'active'`.
2. Requisições subsequentes servem esse snapshot diretamente (TTL longo) **sem** re-executar o registry de compilers de blocos.
3. Quando o registry (`supabase/functions/_shared/block-compiler/index.ts` ou `blocks/*.ts`) é alterado — bloco renomeado, novo compiler registrado, alias removido —, os snapshots antigos contêm o HTML produzido pela **versão anterior** do registry. Blocos cuja chave não existia ou foi alterada simplesmente desaparecem do HTML servido.
4. Deploy do `storefront-html` apenas atualiza o código; **não invalida** os snapshots já materializados.
5. `?_revalidate=1` invalida CDN/edge cache, mas **não** força recompilação dos snapshots persistidos no banco.

**Solução aplicada:**
1. **Invalidação total via SQL** (idempotente, segura):
   ```sql
   UPDATE public.storefront_prerendered_pages
      SET status = 'stale'
    WHERE status = 'active';
   ```
   Marca todos os snapshots como obsoletos. A próxima requisição recompila com o registry atual.
2. **Re-deploy do `storefront-html`** para garantir que o registry mais recente está ativo no Edge.
3. **Validação por curl** no domínio público confirmando presença dos marcadores (`data-product-id`, `sf-fp-…`) no HTML servido.

**Onde ocorreu:** Pipeline Edge — `supabase/functions/storefront-html/`, tabela `public.storefront_prerendered_pages`.

**Regra derivada (ANTI-REGRESSÃO MANDATÓRIA):**

> **Toda alteração no registry de compilers de blocos do storefront** (em `supabase/functions/_shared/block-compiler/`) — incluindo: registrar novo compiler, remover compiler, renomear chave, alterar alias, modificar contrato de props lidas pelo compiler — **OBRIGA** a execução conjunta de:
>
> 1. `deploy_edge_functions(['storefront-html'])`
> 2. `UPDATE storefront_prerendered_pages SET status='stale' WHERE status='active'` (escopo: tenants afetados ou global, conforme amplitude da mudança)
> 3. Validação por `curl` no domínio público confirmando o HTML esperado.
>
> **NÃO BASTA:** revalidar pelo Builder, usar `?_revalidate=1` ou aguardar TTL. Esses caminhos não recompilam snapshots persistidos.

**Sinais de regressão (red flags):**
- Bloco visível no Builder mas ausente no HTML público.
- HTML público com marcadores de blocos antigos que já foram removidos do código.
- Discrepância entre `curl <dominio>?_debug=1` e o conteúdo do template publicado.
- HTML servido com ~951 bytes (shell SPA vazio) e `cf-cache-status: DYNAMIC` sem `X-CC-Render-Mode` → bypass do pré-render.
- TTFB OK (~600ms) mas LCP/conteúdo visível 4–6s.
- `>20%` de linhas `stale` em `storefront_prerendered_pages` ao agrupar por status.

**Anti-stale automático via versionamento (v8.8.0+, Abr/2026):**

Para evitar que snapshots gravados por uma versão anterior do compilador continuem sendo servidos por horas após o deploy, `storefront-html` compara `metadata.storefront_html_version` do snapshot com sua própria constante `VERSION`. Se diferirem, ignora o snapshot e força live render. O snapshot só volta a ser servido quando `storefront-prerender` regravar com a mesma versão.

> **Toda mudança em compiladores ou no contrato HTML de hidratação deve bumpar `VERSION`** em `supabase/functions/storefront-html/index.ts`. Esse é o único gatilho confiável de invalidação automática. O `UPDATE … SET status='stale'` continua valendo como cinto-e-suspensório quando há baixa confiança no estado dos snapshots, mas não é mais o único caminho.

**Sintoma típico de regressão (Abr/2026):** captura de leads (popup, rodapé, blocos) aparenta quebrada na loja pública mesmo com `marketing-form-submit` 100% funcional. Causa: HTML servido foi gerado por uma versão anterior do `storefront-html` que não injetava o handler universal `[data-sf-newsletter]` ou usava `data-source` divergente. Solução: bumpar `VERSION` + invalidar snapshots.

**Procedimento de diagnóstico rápido:**
```bash
# 1. Comparar HTML servido com template salvo
curl -s https://<dominio-tenant>/?_revalidate=1 | grep -c "data-product-id"
# Se 0 → cache stale provável

# 2. Conferir status dos snapshots
SELECT tenant_id, page_type, status, updated_at
  FROM public.storefront_prerendered_pages
 WHERE tenant_id = '<uuid>' ORDER BY updated_at DESC;

# 3. Se houver 'active' anteriores ao último deploy do compiler → invalidar
```

---

### 9.2 Bug silencioso por coluna inexistente em queries de produto (Abril/2026)

**Problema:** Edge functions retornavam `success: true` com listas vazias ou parciais ao consultar imagens de produtos, sem nenhum erro visível em logs.

**Sintoma visível:**
- `storefront-bootstrap` respondia OK mas com 0 produtos para tenants ativos.
- Loja pública aparentava estar "sem catálogo" intermitentemente.
- Sem erro nos logs porque o erro do PostgREST era silenciosamente engolido pelo bloco try/catch que retornava o envelope `success` padrão.

**Causa raiz:** Queries em `product_images` referenciavam a coluna `position` (que não existe). O nome correto da coluna de ordenação é `sort_order`. O erro `PGRST204 / column product_images_1.position does not exist` ficava mascarado dentro do envelope de resposta.

**Onde ocorreu:** `storefront-bootstrap`, `tiktok-shop-catalog-sync`, `ads-chat-v2` (Abril/2026).

**Solução aplicada:** Substituir todas as ocorrências de `position` por `sort_order` nas queries de `product_images` nas edge functions afetadas. Após correção, `storefront-bootstrap` voltou a retornar 33 produtos em 668ms.

**Regra derivada:**

> Toda edge function que retorna envelope `{ success, data, error }` DEVE logar explicitamente o `error.message` do Supabase antes de mascará-lo no envelope. Erro silencioso de schema é o pior tipo de bug — quebra produção sem alerta.
>
> **Nome canônico da coluna de ordenação de mídias:** `sort_order` (NUNCA `position`, `order`, `seq` ou variações). Vale para `product_images`, `product_videos` e qualquer tabela de mídia.

---

## Como Adicionar Novas Entradas

Ao resolver um bug ou tomar uma decisão técnica significativa, adicionar entrada aqui seguindo o formato:

```markdown
### X.N Título curto

**Problema:** O que acontecia / o sintoma visível
**Causa raiz:** Por que acontecia (técnico)
**Solução:** O que foi feito para resolver
**Onde ocorreu:** Arquivo(s) / módulo afetado
**Regra derivada:** Regra geral para evitar recorrência
```


---

### N. Edge Functions: import legado `deno.land/std` quebra deploys

**Problema:** Deploys de Edge Functions falhavam com `500 Internal Server Error` ao tentar resolver `https://deno.land/std@0.168.0/http/server.ts`. Como o bundler é compartilhado, **a falha de uma função quebrava o deploy de todas as outras** — incluindo correções não relacionadas (ex.: WhatsApp/Meta health-check).

**Causa raiz:** Instabilidade do CDN `deno.land` + Edge Runtime atual já oferece `Deno.serve` nativo, tornando o import externo desnecessário e frágil.

**Solução:** Normalização em massa de 207 funções:
- Remoção do `import { serve } from "https://deno.land/std@.../http/server.ts"`.
- Substituição de todas as chamadas `serve(handler)` por `Deno.serve(handler)`.
- Preferência por especificadores `npm:` no lugar de `https://esm.sh/...` quando aplicável.

**Onde ocorreu:** `supabase/functions/**/index.ts` (todas).

**Regra derivada (anti-regressão — MANDATÓRIA):**
1. **Proibido** importar `serve` de `deno.land/std` em qualquer nova Edge Function. Usar `Deno.serve(...)` nativo.
2. Para o cliente Supabase, preferir `import { createClient } from "npm:@supabase/supabase-js@2"`.
3. Antes de declarar uma entrega de Edge Function como concluída, executar deploy real (não apenas build do front) — o build do Vite **não** detecta erros de bundle do Edge Runtime.
4. Se um deploy quebrar por falha de CDN externa em função alheia ao escopo, aplicar este mesmo patch antes de prosseguir (regressão conhecida).

---

### N+1. WhatsApp: troca de WABA tratada como saúde operacional

**Problema:** Após troca de WABA / Phone Number ID em um tenant (`respeiteohomem`), o sistema continuava reportando o canal como "conectado" / "saudável" mesmo sem nenhuma mensagem inbound chegando ao novo número. O hub de integrações, o card de saúde e o `useWhatsAppStatus` liam apenas `connection_status='connected'` e tratavam isso como prova de operação. Resultado: ciclos de diagnóstico que voltavam à mesma hipótese externa (display name, billing, aprovação Meta) sem evidência operacional.

**Causa raiz:** A leitura pública do canal era binária ("conectado/desconectado"). Não existia distinção entre **vínculo técnico** (token + WABA + webhook OK) e **operação real** (inbound recente). Salvar novos identificadores em `whatsapp_configs` era tratado como sucesso completo, e nada rebaixava o status enquanto o novo número não comprovasse recepção.

**Solução aplicada (v2026-04-20):**
1. Migração: novas colunas em `whatsapp_configs` — `previous_phone_number_id`, `previous_waba_id`, `linked_at`, `migration_observation_until`, `last_inbound_at`.
2. Trigger `whatsapp_configs_track_migration`: ao mudar `phone_number_id` ou `waba_id`, captura o anterior, reseta `linked_at`, abre janela `migration_observation_until = now()+24h` e zera `last_inbound_at`.
3. `meta-whatsapp-webhook`: na primeira inbound do novo número grava `last_inbound_at = now()` e zera `migration_observation_until` — só então o canal pode voltar a "saudável".
4. `whatsapp-health-summary`: passou a retornar `link_status` (vínculo) e `operational_status` (operação) separados, com rótulos prontos em PT-BR.
5. `useWhatsAppStatus`, `useIntegrationStatus` e `WhatsAppHealthCard`: consomem ambas as camadas. O canal só aparece como "Recebendo normalmente" quando os dois estiverem OK simultaneamente. UI do card mostra "Vínculo técnico" e "Operação real" lado a lado e exibe banner amarelo "Vínculo trocado, em observação" durante a janela.

**Onde ocorreu:** `whatsapp_configs`, `meta-whatsapp-webhook`, `whatsapp-health-summary`, `useWhatsAppStatus`, `useIntegrationStatus`, `WhatsAppHealthCard`.

**Regra derivada (anti-regressão — MANDATÓRIA):**
1. **Proibido** reportar o canal WhatsApp como "saudável" / "conectado" / "ok" baseando-se apenas em `connection_status`. Sempre validar `link_status` + `operational_status`.
2. **Proibido** considerar troca de WABA / Phone Number ID concluída sem janela de observação de 24h ativa.
3. **Proibido** voltar a hipóteses externas (display name, billing, aprovação Meta) antes de confirmar `link_status=connected` e `operational_status` em `observation` ou `degraded` por causa real.
4. Toda nova UI que exibir status do WhatsApp DEVE consumir as duas camadas. Telas que mostrarem apenas "conectado/desconectado" são bug e devem ser corrigidas.
5. Doc formal vivo: `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` v1.1.

---

### 8.X IA continua respondendo após "desativar canal" pela UI

**Problema:** Após desativar um canal de atendimento (WhatsApp / Chat do Site / Instagram DM / E-mail) na tela `/support` aba **Canais**, a IA continuava respondendo conversas inbound. Confirmado em produção no tenant `respeite-o-homem` em 2026-04-21.

**Sintoma:** Mesmo com todos os canais "desativados" pelo usuário, mensagens recebidas via webhook (Meta WhatsApp) e via Chat do Site continuavam sendo respondidas pela IA, inclusive com conteúdo fora do escopo do tenant (loja de cosméticos respondendo sobre "cueca").

**Causa raiz (dupla):**
1. **Ação "Desativar" deletava o registro** em `channel_accounts` em vez de marcar `is_active = false`. Como os webhooks usavam fallback `is_active ?? true`, a ausência do registro era interpretada como "ativo".
2. **Motor `ai-support-chat` não consultava `channel_accounts`** — verificava só `ai_support_config` (global) e `ai_channel_config` (por canal). Webhooks individuais tinham gates inconsistentes entre si. `channel_accounts` era usada apenas como repositório de credenciais, não como fonte de verdade de "canal habilitado".

**Solução aplicada (v2026-04-21):**
1. **Gate Universal no motor** (`supabase/functions/ai-support-chat/index.ts`): logo após carregar a conversa, antes de qualquer LLM/RAG/tool, consulta `channel_accounts` por `tenant_id` + `channel_type`. Se registro ausente OU `is_active=false` → retorna `CHANNEL_DISABLED` e encerra. Centraliza a verificação para todos os webhooks que invocam a IA.
2. **UI corrigida** (`src/components/support/ChannelIntegrations.tsx`): botão padrão agora é toggle **Desativar / Reativar** (atualiza `is_active`). **Remover Permanentemente** virou ação secundária com confirmação dupla.
3. **Backfill de dados**: para tenants onde os registros já tinham sido deletados, recriados com `is_active=false` para que o gate tenha estado explícito.

**Onde ocorreu:** `channel_accounts`, `ai-support-chat`, `ChannelIntegrations.tsx`, todos os webhooks de canal (`meta-whatsapp-webhook`, `instagram-webhook`, chat do site).

**Validação técnica:**
- Banco: 12 registros em `channel_accounts` para `respeite-o-homem*` com `is_active=false` em todos os canais de IA. ✅
- Edge function: chamada real ao `ai-support-chat` com conversa do tenant retornou `{success:false, code:"CHANNEL_DISABLED"}` — sem invocar LLM. ✅

**Regra derivada (anti-regressão — MANDATÓRIA):**
1. **`channel_accounts` é a única fonte de verdade** para "canal habilitado". Ausência de registro = inativo (sem fallback para `true`).
2. **Proibido** que a UI delete registros de `channel_accounts` como ação primária. Deletar é ação secundária com confirmação. Padrão é toggle `is_active`.
3. **Proibido** que qualquer novo motor/agente de IA responda em um canal sem antes consultar `channel_accounts.is_active` para o `tenant_id` + `channel_type` corretos.
4. **Proibido** confiar apenas em `ai_support_config` ou `ai_channel_config` para decidir se a IA responde — esses dois são camadas adicionais (ON/OFF lógico da IA), não substituem o gate de canal.
5. Doc formal vivo: `docs/especificacoes/crm/crm-atendimento.md` §5.1 "Gate Universal de Canal".

---

## 9. Estabilização do Atendimento e Cérebro de IA (Blocos D6–D10) — 2026-04-26

Bloco de 5 estabilizações entregues em sequência sobre o motor de atendimento e o ecossistema de IA. Cada item registra o problema original, a causa raiz, a solução aplicada e a validação técnica que justifica o fechamento.

### 9.1 D6 — Gate Universal de Canal de Atendimento

**Problema:** IA continuava respondendo após "desativar canal" pela UI.

**Causa raiz:** ação "Desativar" deletava registro em `channel_accounts` em vez de marcar `is_active = false`; motor `ai-support-chat` não consultava essa tabela como fonte de verdade.

**Solução:** gate universal no início do `ai-support-chat` consulta `channel_accounts` por `tenant_id` + `channel_type` antes de qualquer LLM/RAG/tool. UI corrigida para toggle `is_active` como ação primária.

**Validação técnica:** ver §8.X desta base — registros confirmados no banco e chamada real à edge function retornando `CHANNEL_DISABLED` sem invocar LLM.

**Doc vivo:** `docs/especificacoes/crm/crm-atendimento.md` §5.1.

### 9.2 D7 — Pipeline de Mídia no Atendimento (Imagem e Áudio)

**Problema:** mídia (imagem/áudio) entrava no atendimento mas a IA respondia antes de a descrição/transcrição estar pronta, ou enviava múltiplas mensagens de espera, ou reprocessava em loop.

**Causa raiz:** ausência de gate de espera explícito no motor; ausência de flag anti-loop para a mensagem de espera; ausência de marcação auditável do consumo da descrição/transcrição no contexto do LLM.

**Solução:** 4 mecanismos obrigatórios — gate `pending_media_processing` no chat, flag `media_wait_reply_sent` para anti-loop, reprocesso único garantido após conclusão da fila, registro `consumed_at` provando injeção no contexto.

**Validação técnica:** harness `d7-media-harness` provou os 6 pontos fim a fim — entrada, enfileiramento (`vision`/`transcription`), `status = completed` com `processed_at`, `consumed_at` preenchido antes da resposta, sem duplicação, limpeza de estado.

**Regras anti-regressão:** ver `docs/especificacoes/crm/crm-atendimento.md` §14.1.6.

**Doc vivo:** `docs/especificacoes/crm/crm-atendimento.md` §14.1 e §17.1.

### 9.3 D8 — Cérebro Regenerativo (Insights Aprovados nos 4 Agentes)

**Problema:** aprendizados capturados em conversas reais não chegavam ao system prompt dos agentes — a IA não evoluía com o uso.

**Causa raiz:** ausência de pipeline formal de captura → consolidação → aprovação humana → injeção. Não havia view ativa nem helper compartilhado para concatenar os insights ao prompt.

**Solução:** tabela `ai_brain_insights` com status (pending/active/revoked/expired) e 4 escopos por agente (`scope_vendas`, `scope_auxiliar`, `scope_landing`, `scope_trafego`); view `ai_brain_active_view` para leitura em runtime; helper `_shared/brain-context.ts` consumido pelos 4 agentes (`ai-support-chat`, `command-assistant-chat`, `ai-landing-page-generate`, `ads-autopilot-*`).

**Validação técnica:** harness `d8-brain-harness` provou que um insight aprovado de tipo `objecao` (escopo `vendas`) foi injetado no system prompt do agente de vendas, e que o agente `landing` recebeu contexto vazio por não ter o escopo correspondente — isolamento confirmado.

**Doc vivo:** `docs/especificacoes/sistema/central-comando.md` §4.

### 9.4 D9 — Estabilização de Conexões e Status de WhatsApp

**Problema:** UI reportava WhatsApp como "saudável" mesmo com canal degradado ou desconectado real.

**Causa raiz:** decisão baseada apenas em `connection_status`, ignorando `link_status` + `operational_status`.

**Solução:** todo consumidor (UI, webhooks, motores de IA) passou a validar as duas camadas; janela de observação de 24h após troca de WABA / Phone Number ID.

**Validação técnica:** ver §8 desta base — campos validados no banco, UI e webhooks consumindo a regra unificada.

**Doc vivo:** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` v1.1.

### 9.5 D10 — Auditoria Cruzada de Recepção (Fonte de Verdade)

**Problema:** ausência de mensagens era declarada com base em uma única fonte (auditoria), gerando falso negativo quando o problema estava em conversa/mensagem do atendimento.

**Causa raiz:** verificação isolada em uma tabela só; falta de regra de cruzamento obrigatório.

**Solução:** regra mandatória de cross-check entre `whatsapp_audit`, `conversations` e `messages` antes de declarar "não recebido". Memória de constraint formalizada (`mem://constraints/whatsapp-reception-source-of-truth-cross-check`).

**Validação técnica:** auditável — toda investigação de recepção deve apresentar consulta às 3 fontes, não apenas à auditoria.

**Doc vivo:** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` (regra de diagnóstico).

### 9.6 Regra Geral do Bloco (Anti-Regressão MANDATÓRIA)

1. **Proibido** alterar o motor `ai-support-chat`, o helper `_shared/brain-context.ts`, o helper `_shared/media-context.ts` ou a fila `ai_media_queue` sem rodar os harnesses correspondentes (`d7-media-harness` para mídia, `d8-brain-harness` para cérebro) e provar todos os pontos.
2. **Proibido** remover as Edge Functions de harness (`d7-media-harness`, `d8-brain-harness`) sem substituto equivalente. Elas são parte do contrato de fechamento técnico.
3. **Proibido** declarar resposta de IA válida em conversa com mídia sem `consumed_at` no anexo.
4. **Proibido** insight do cérebro entrar em produção sem aprovação humana explícita (clique no admin) — não há aprovação automática.

---

## 10. Painel Saúde do Sistema — Timeout em Jobs Automatizados — 2026-04-28

**Problema:** o bloco de tarefas automatizadas em `/platform/system-health` falhava de forma intermitente enquanto os demais KPIs continuavam carregando.

**Causa raiz:** a rotina de leitura dos jobs consultava o histórico de execuções com subconsultas repetidas por job em `cron.job_run_details`. Em ambiente real, isso ultrapassava o timeout do PostgREST (~8s), retornando erro 500 só para `get_cron_jobs_status`.

**Solução aplicada:**
1. Reescrita de `get_cron_jobs_status()` para uma estratégia de agregação única da janela de 24h (`recent_runs` + `latest_run` + `run_counts`), eliminando leituras correlacionadas repetidas.
2. Preservação do mesmo contrato funcional do painel: nome, agendamento, última execução, status, duração, falhas e sucessos nas últimas 24h.
3. Normalização do tratamento de erro no frontend (`useSystemHealth`) para converter erros RPC em mensagens legíveis, impedindo fallback opaco como `[object Object]`.

**Validação técnica:**
- Browser/network no preview logado: `POST /rpc/get_cron_jobs_status` passou de `500 timeout` para `200` em ~393ms. ✅
- Fluxo correlato preservado: `get_system_health_overview`, `get_queue_health` e `get_top_slow_queries` também responderam `200`. ✅
- Testes rápidos de regressão frontend: `vitest` com 30 testes aprovados. ✅

**Regra derivada (anti-regressão — MANDATÓRIA):**
1. Toda RPC de observabilidade que consulte tabelas de histórico/telemetria (`cron`, logs, stats) deve agregar em lote antes de expor dados ao painel; subconsulta correlacionada por linha é proibida sem prova de performance.
2. Nenhum painel pode degradar erro estruturado de RPC para `String(obj)` no UI; erros precisam ser normalizados para mensagem legível.
3. Antes de declarar corrigido um painel operacional, validar a chamada real no network/browser ou consulta equivalente no ambiente autenticado.


---

## 10. Onda 2 — Resiliência Observável (2026-04-28)

**Contexto:** Após a Onda 1 dar visibilidade do banco/cron/filas, restavam falhas silenciosas em dois fluxos críticos: mensagens WhatsApp recebidas que não chegavam ao processamento, e pagamentos aprovados pelo gateway sem pedido correspondente.

**Decisão arquitetural:** Resiliência via observabilidade + ação manual. **Nenhum reprocessamento automático foi adicionado** — qualquer auto-reconcile de mensagem ou criação automática de pedido por pagamento órfão poderia gerar duplicatas. Constraints relacionadas: `mem://constraints/whatsapp-reception-source-of-truth-cross-check`, `mem://constraints/observability-over-automation-rule`.

**Implementação:**
- 3 novos KPIs no header do painel `/platform/system-health`:
  - Mensagens WhatsApp travadas (>5 min sem `processed_at`)
  - Incidentes WhatsApp abertos (`whatsapp_health_incidents` em `open|acknowledged`)
  - Divergências de pagamento 24h (`payment_transactions` aprovado sem `order_id` ou pedido inexistente)
- 2 novas abas detalhadas: **WhatsApp** (incidentes + mensagens órfãs com botão "Resolver") e **Pagamentos** (divergências com filtro 24h/7d/30d).
- Toda leitura via RPC `SECURITY DEFINER` restrita a `is_platform_admin()`:
  - `get_resilience_kpis()`
  - `get_whatsapp_incidents(p_limit)`
  - `get_whatsapp_orphan_inbound(p_limit)`
  - `get_payment_divergences(p_window_hours, p_limit)`
- Única RPC de escrita: `resolve_whatsapp_incident(p_incident_id, p_resolution_note)` — ação manual do operador, registra `resolved_by` no `metadata` do incidente.

**Anti-regressão:**
1. Não criar cron de auto-reconcile sobre `whatsapp_inbound_messages` ou `payment_transactions` sem aprovação formal e sem garantir idempotência comprovada.
2. Toda nova fila sensível deve ganhar primeiro um KPI + lista no painel; cron só depois com plano explícito.
3. RPCs de leitura para o painel `/platform/system-health` seguem o padrão `mem://constraints/platform-admin-auth-and-observability-rpc-standard`: `SECURITY DEFINER`, `SET search_path = public`, `REVOKE` de anon/public, `GRANT EXECUTE` apenas para `authenticated`, e validação `is_platform_admin()` na primeira linha.

---

## 2026-04-28 — Hardening de Funções SECURITY DEFINER (Onda 3.4 — encerrada)

**Contexto:** Auditoria sistêmica de funções `SECURITY DEFINER` no schema `public` que recebem `p_tenant_id` como parâmetro. Sem proteção interna, qualquer usuário autenticado podia chamar essas funções via PostgREST passando o tenant alheio e obter ou modificar dados cross-tenant — bypass total da RLS.

**Padrão aplicado (Pattern 6 — Tenant Identity Guard):**
```sql
IF auth.role() <> 'service_role' AND NOT public.user_has_tenant_access(p_tenant_id) THEN
  RAISE EXCEPTION 'Access denied to tenant %', p_tenant_id USING ERRCODE = '42501';
END IF;
```
- Permite chamadas internas (Edge Functions com `service_role`).
- Bloqueia chamadas autenticadas que apontem para tenant que o usuário não pertence.
- Compatível com triggers (rodam como `service_role`).

**Cobertura por onda:**
- **3.4-A**: funções já cobertas previamente (auditoria sem ação).
- **3.4-B** (3 funções operacionais): `count_unique_visitors`, `update_customer_order_stats`, `log_marketing_sync_audit`.
- **3.4-C** (15 funções acessíveis pela UI): `check_module_access`, `search_products_fuzzy`, `initialize_system_pages`, `recalc_customer_metrics`, entre outras.
- **3.4-D** (15 funções service_role-only): `add_credits`, `enqueue_ai_regeneration`, `generate_order_number`, `generate_review_token`, `generate_tenant_invoice`, `generate_unsubscribe_token`, `get_ai_memories`, `get_recent_conversation_summaries`, `hydrate_whatsapp_token_from_active_grant`, `increment_ai_metrics`, `increment_creative_usage`, `increment_tenant_order_usage`, `record_ai_usage`, `supersede_meta_grant`, `upsert_subscriber_only`.

**Total:** 33 funções com guard injetado.

**Conversões de linguagem:** Funções originalmente `LANGUAGE sql` que retornavam `TABLE(...)` foram convertidas para `plpgsql` com `RETURN QUERY` para suportar a cláusula de exceção. Quando houve mudança de assinatura interna (apenas language), foi necessário `DROP FUNCTION IF EXISTS` antes do `CREATE`.

**Exceções documentadas (sem guard, intencional):**
- `get_public_marketing_config(p_tenant_id)`: chamada por anon no storefront público; retorna apenas IDs de pixel (Meta/Google/TikTok) que já estão visíveis no HTML público. Aplicar guard quebraria o tracking do storefront.

**Anti-regressão:**
1. Toda nova função `SECURITY DEFINER` que receba `p_tenant_id` DEVE incluir o guard Pattern 6 já no primeiro `BEGIN`.
2. Funções públicas (chamadas por anon no storefront) que recebam `p_tenant_id` só ficam isentas se retornarem APENAS dados já visíveis publicamente. Documentar a exceção no doc de hardening.
3. Mudança de `LANGUAGE sql` para `plpgsql` exige `DROP FUNCTION` quando a assinatura/retorno se mantém igual mas o language muda — `CREATE OR REPLACE` sozinho falha.
4. Mudança de tipo de retorno (ex.: `integer` → `uuid`) também exige `DROP FUNCTION` antes.
5. A migration deve preservar os defaults originais dos parâmetros (verificar `pg_get_functiondef` antes de reescrever).

**Validação técnica executada:**
- ✅ As 33 funções aparecem em `pg_proc` com `user_has_tenant_access` no corpo.
- ✅ Migration aplicada sem regressão funcional (testes de fluxo: `add_credits` via edge function, `generate_order_number` via trigger, `get_ai_memories` via UI).
- ✅ Linter Supabase: 219 alertas (4 novos `Function Search Path Mutable` em funções já existentes, não relacionados às mudanças desta onda — pré-existentes nas funções convertidas para plpgsql; `SET search_path TO 'public'` foi preservado em todas).

---

## 2026-04-28 — Hardening de Superfície de Ataque (Onda 4.1 — encerrada)

**Objetivo:** Reduzir o número de funções `SECURITY DEFINER` invocáveis via `POST /rest/v1/rpc/<name>` por roles `anon`/`authenticated`/`PUBLIC`. A Onda 3 instalou guard interno (Pattern 6); a Onda 4.1 fecha a porta de entrada antes que o guard seja invocado, conforme recomendação oficial dos lints `0028_anon_security_definer_function_executable` e `0029_authenticated_security_definer_function_executable`.

**Resultado mensurável:** Alertas do Supabase Linter caíram de **219 → 75** (redução de **144 alertas**, ~66%).

**Padrão de classificação aplicado (4 categorias):**

| Categoria | Critério | Decisão de grant | Nº de funções |
|---|---|---|---|
| **A — Já protegidas (Onda 3)** | Grants já restritos a `service_role`/`postgres` | Manter como está | 25 |
| **B — Helpers de RLS** | Função aparece em `USING/CHECK` de policy `pg_policies` | Manter `EXECUTE` para `anon` E `authenticated` (Postgres precisa avaliar a policy no role do caller) | 9 |
| **C — Trigger functions** | Função associada a `pg_trigger` (não-interno) | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` (trigger executa no contexto do banco; grant é irrelevante) | 27 |
| **D — RPC chamada pelo front logado** | Aparece em `grep -rohE '\.rpc\("name"' src/` | `REVOKE FROM PUBLIC, anon` + manter `authenticated` | 22 |
| **E — Edge-only / service_role** | Restantes (chamadas só por edge functions) | `REVOKE FROM PUBLIC, anon, authenticated` (edge usa `service_role`) | ~37 |
| **F — Pública intencional** | `get_public_marketing_config` — usada pelo storefront público | Manter `anon` E `authenticated` (documentada como exceção) | 1 |

**Trava futura (mandatória — sem isso novas funções nascem vulneráveis de novo):**
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
```

**Exceções formalmente declaradas (não devem ser "corrigidas" no futuro):**

1. **RLS Helpers (B):** `belongs_to_tenant`, `get_current_tenant_id`, `has_role`, `is_owner_of_member_tenant`, `is_platform_admin_by_auth`, `is_tenant_owner`, `user_belongs_to_tenant`, `user_has_tenant_access` — Postgres precisa de `EXECUTE` para o role que dispara a query, senão **toda RLS quebra com erro 42501**. Lint aceita como exceção.
2. **Pública (F):** `get_public_marketing_config(uuid)` — endpoint público do storefront por design. Filtra dados internamente para devolver apenas configurações de marketing já visíveis na vitrine.
3. **`is_platform_admin()`:** mantém `authenticated` (não `anon`) por ser usada por hooks da UI logada.

**Anti-regressão:**

1. Toda nova função `SECURITY DEFINER` nasce sem grant para `anon`/`authenticated`/`PUBLIC` por causa do `ALTER DEFAULT PRIVILEGES`. Para RPCs chamadas pelo front, conceder explicitamente: `GRANT EXECUTE ON FUNCTION public.<fn> TO authenticated;`
2. Antes de remover uma função da lista de exceções B (RLS helpers), validar com `SELECT * FROM pg_policies WHERE qual::text LIKE '%<fn>%' OR with_check::text LIKE '%<fn>%';` — se aparecer em alguma policy, NÃO revogar.
3. Quando uma função sai de "edge-only" para "chamada pelo front", concedê-la a `authenticated` na mesma migration que adiciona a chamada no `src/`.

**Validação técnica executada:**
- ✅ `pg_proc.proacl` confirma 22 RPCs do front com `authenticated=X/postgres`, `anon` ausente.
- ✅ `pg_proc.proacl` confirma 9 RLS helpers preservaram `anon=X/postgres` e `authenticated=X/postgres`.
- ✅ `get_public_marketing_config` mantém `anon=X/postgres` (exceção F).
- ✅ Total de funções `SECURITY DEFINER` ainda expostas a `anon`: 9 (helpers RLS) + 1 (pública intencional) = **10**, todas declaradas.
- ✅ Total expostas a `authenticated`: 31 (9 helpers + 22 RPCs do front + alguns auxiliares de apps internos).
- ✅ Linter Supabase: 75 alertas (queda de 144). Restam: 27 RLS Policy Always True (Onda 4.2), 4 Public Bucket Allows Listing (Onda 4.3), ~40 EXECUTE em funções legítimas (B+D+F — exceções), 1 search_path mutable, 1 Extension in public, 1 RLS enabled no policy, 1 Leaked password protection (Onda 5).

**Próximas ondas:**
- ~~**Onda 4.2:** Refazer 27 policies RLS com `USING (true)` / `WITH CHECK (true)` em INSERT/UPDATE/DELETE.~~ ✅ **Encerrada em 2026-04-28** (ver seção abaixo).
- **Onda 4.3:** Restringir 4 buckets públicos com policy de listagem aberta.
- **Onda 4.4:** Mover extensão de `public` para `extensions`, criar policy na tabela órfã, fixar `search_path` na função remanescente.
- **Onda 5:** Auth hardening (leaked password, OTP expiry, MFA platform admin).

---

## 2026-04-28 — Hardening de Políticas RLS Permissivas (Onda 4.2 — encerrada)

**Objetivo:** Eliminar policies RLS de escrita (INSERT/UPDATE/DELETE/ALL) com `USING (true)` ou `WITH CHECK (true)` sem restrição de role/tenant, conforme lint `0024_permissive_rls_policy`. Auditoria classificou 42 policies em 4 categorias e tratou 30 delas (Cat A, C, D); Cat B é falso-positivo aceito e documentado.

### Categorias de classificação

**Categoria A — Service-role atribuída a `public` (BUG real, 17 policies corrigidas):**
Policies cujo nome dizia "Service role" mas estavam atribuídas ao role `public`, abrindo acesso a `anon`/`authenticated`. Tabelas: `ads_autopilot_artifacts`, `billing_events`, `core_audit_log`, `email_conversions`, `email_tracking_tokens`, `google_ad_ads/assets/groups/keywords`, `google_business_posts/reviews`, `google_search_console_data`, `meta_ad_ads/adsets`, `meta_whatsapp_onboarding_states`, `tiktok_shop_returns`, `whatsapp_inbound_messages`. **Correção:** `DROP POLICY` + `CREATE POLICY ... TO service_role`.

**Categoria B — Service-role já correto (15 policies — falso-positivo aceito):**
Policies já em `roles: {service_role}` com `USING (true)`. Linter ainda alerta porque vê `true` literal, mas service_role faz bypass natural de RLS — a expressão é cosmética. **Decisão:** manter como está. Tabelas: `ad_insights_sync_coverage`, `ai_signal_capture_queue`, `ai_support_tool_calls`, `command_insights`, `meta_oauth_states`, `store_page_versions`, `store_pages`, `storefront_cache_health_log`, `support_tickets`, `system_performance_snapshots`, `system_query_stats_snapshots`, `whatsapp_carts`, `whatsapp_health_incidents`, `whatsapp_inbound_debounce`, `wms_pratika_logs`.

**Categoria C — Endpoints públicos legítimos do storefront (8 policies endurecidas):**
Tabelas que precisam aceitar escrita anônima (carrinho/checkout convidado, reviews, cotação CEP, analytics) mas tinham `WITH CHECK (true)` cego. **Correção:** `WITH CHECK (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id))`. Para `cart_items` valida via `cart_id` (parent cart existe). Para `checkouts` valida `cart_id` quando informado. Tabelas: `affiliate_clicks`, `carts` (INSERT/UPDATE), `cart_items` (ALL), `checkouts` (INSERT/UPDATE), `product_reviews`, `shipping_quotes`, `storefront_visits`.

**Categoria D — Privilege escalation (1 policy crítica removida):**
`user_roles` tinha `INSERT TO authenticated WITH CHECK (true)` — qualquer usuário autenticado podia se conceder qualquer role (inclusive `owner`) em qualquer tenant. **Correção:** `DROP POLICY "System can insert roles"`. Inserções legítimas continuam via policy `Owner can manage tenant user_roles` (com check `is_tenant_owner`) ou via `service_role` em Edge Functions administrativas.

### Padrão obrigatório para novas policies

```sql
-- ❌ NUNCA: nome contradiz role
CREATE POLICY "Service role full access" ON tbl
  FOR ALL TO public USING (true);  -- BUG: público vê tudo

-- ✅ SEMPRE: role explícito + nome coerente
CREATE POLICY "Service role full access" ON tbl
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ✅ Endpoint público: validar tenant existe
CREATE POLICY "Anyone can insert X" ON tbl
  FOR INSERT TO public
  WITH CHECK (tenant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenants WHERE id = tenant_id
  ));

-- ✅ Tabela de papéis: NUNCA permitir self-assignment
-- Apenas owner do tenant ou service_role podem inserir em user_roles.
```

### Validação técnica

- ✅ Linter Supabase: **75 → 48 alertas** (queda de 27, -36%).
- ✅ Migrations: `20260428_wave_4_2_step_1_user_roles`, `_step_2_service_role_fix`, `_step_3_storefront_tenant_validation`.
- ✅ `pg_policies` confirma todas as 17 policies da Cat A agora têm `roles: {service_role}`.
- ✅ Storefront público continua funcional (carts, checkouts, reviews, shipping_quotes, storefront_visits aceitam INSERT anônimo desde que tenant exista).
- ✅ `user_roles`: tentativa de self-insert por authenticated agora é bloqueada por RLS.

### Próximas ondas

- ~~**Onda 4.3:** 4 buckets públicos com listagem aberta (`storage.objects` SELECT amplo).~~ ✅ **Encerrada em 2026-04-28** (ver seção abaixo).
- **Onda 4.4:** Mover extensão de `public` para `extensions`, criar policy na tabela órfã (RLS Enabled No Policy), fixar último `search_path` mutable.
- **Onda 5:** Auth hardening (leaked password protection, OTP expiry, MFA para platform admin).

---

## 2026-04-28 — Hardening de Buckets Públicos (Onda 4.3 — encerrada)

**Objetivo:** Eliminar listagem aberta (LIST/enumerate) em buckets públicos do Storage, conforme lint `0025_public_bucket_allows_listing`. Ataques de enumeração permitiam listar todos os arquivos de todos os tenants, vazando SKUs internos, padrões de nomenclatura, volume comercial e arquivos órfãos.

### Princípio fundamental do Supabase Storage

> **Buckets `public:true` permitem leitura individual via URL direta sem passar por RLS.**
> RLS SELECT em `storage.objects` controla apenas a API de **LIST/enumerate**, não a leitura individual.

Portanto, restringir SELECT no `storage.objects` **não quebra o storefront** — visitantes anônimos continuam carregando imagens via URL pública direta (`https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>`). O que muda é só a capacidade de listar/enumerar via `storage.from(bucket).list(...)`.

### Buckets corrigidos

| Bucket | Padrão de path | Nova policy SELECT |
|--------|----------------|---------------------|
| `product-images` | `<tenant_id>/...` | `authenticated` + `EXISTS user_roles WHERE tenant_id = foldername[1]` |
| `published-assets` | `<tenant_id>/...` | `authenticated` + `EXISTS user_roles WHERE tenant_id = foldername[1]` |
| `store-assets` | `<tenant_id>/...` ou `tenants/<tenant_id>/...` | `authenticated` + dual-pattern check |
| `media-assets` | `<tenant_id>/...` | `authenticated` + tenant ownership |
| `review-media` | `reviews/...` (sem tenant_id no path) | `service_role` apenas (admin via Edge Function) |

### Padrão obrigatório para novas policies em `storage.objects`

```sql
-- ❌ NUNCA: listagem aberta
CREATE POLICY "..." ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'meu-bucket');  -- vaza tudo de todos os tenants

-- ✅ SEMPRE: tenant-scoped via foldername
CREATE POLICY "..." ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'meu-bucket'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- ✅ Quando o path NÃO carrega tenant_id: restringir a service_role
-- e mediar acesso via Edge Function que valida tenant via tabela relacionada
CREATE POLICY "..." ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'meu-bucket');
```

### Restrição operacional importante

`COMMENT ON TABLE storage.objects` **falha** com `must be owner of table objects` (42501). Supabase reserva alterações estruturais em `storage` schema. **Apenas policies podem ser criadas/dropadas** em `storage.objects` — nunca COMMENT, ALTER, INDEX ou TRIGGER.

### Validação técnica

- ✅ Linter Supabase: **48 → 44 alertas** (-4, todos os 4 alertas `0025_public_bucket_allows_listing` eliminados).
- ✅ `pg_policies` em `storage.objects` confirma todas as 5 policies SELECT em buckets públicos agora usam `roles: {authenticated}` ou `{service_role}` com restrição de tenant/path.
- ✅ Storefront (anônimo): leitura individual via URL pública continua funcional (não passa por RLS).
- 🔬 Pendente validação do usuário: testar painel admin (listagem de imagens de produtos, assets de loja, mídias de reviews).

### Próximas ondas

- **Onda 4.4:** Mover extensão de `public` para `extensions`, criar policy na tabela órfã (RLS Enabled No Policy), fixar último `search_path` mutable.
- **Onda 5:** Auth hardening (leaked password protection, OTP expiry, MFA para platform admin).

## 2026-04-28 — Hardening final + HIBP (Onda 4.4 — encerrada)

**Objetivo:** Fechar a Onda 4 tratando os warnings residuais (extensão em public, função sem search_path, RLS sem policy, SECURITY DEFINER administrativas) e ativar Leaked Password Protection.

### Ações executadas

| Frente | Ação | Resultado |
|--------|------|-----------|
| Função admin sem uso pelo client | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` em `update_customer_order_stats(uuid)`; `GRANT ... TO service_role` | -1 alerta SECURITY DEFINER |
| RLS Enabled No Policy | `ai_model_param_compat`: policy SELECT pública (catálogo de referência) + ALL para service_role | -1 alerta INFO |
| Leaked Password Protection | `configure_auth({password_hibp_enabled: true})` | Auth atualizado |
| Function Search Path Mutable | Investigado: 0 funções `public` sem search_path. Alerta restante = extensão nativa (`pgcrypto`/`pgvector`), não modificável | Falso-positivo aceito |
| Extension in Public (`pg_net`) | Não movido — usado por triggers/queues em `_shared/`. Mover quebraria integrações | Exceção aceita |

### 42 alertas restantes (todos exceções arquiteturais)

Ver `mem://constraints/security-linter-accepted-exceptions` para a whitelist completa e justificativa de cada categoria.

| Categoria | Qtd | Status |
|---|---|---|
| SECURITY DEFINER anon (9 helpers RLS) | 9 | Necessário para storefront público |
| SECURITY DEFINER authenticated (RPCs com Tenant Identity Guard) | 31 | Modelo arquitetural validado |
| Extension `pg_net` em `public` | 1 | Risco de mover > ganho |
| Function Search Path (extensão nativa) | 1 | Falso-positivo do linter |

### Validação técnica

- ✅ Migration aplicada com sucesso
- ✅ Linter: 44 → 42 alertas
- ✅ HIBP ativado (Auth configuration updated successfully)
- ✅ `pg_proc` confirma 0 funções `public` SECURITY DEFINER sem search_path
- ✅ Whitelist documentada com base em `rg "\.rpc\(" src/ supabase/functions/`

### Encerramento da Onda 4

| Onda | Foco | Alertas (antes → depois) |
|------|------|---------------------------|
| 4.1 | SECURITY DEFINER EXECUTE revoke default | 75 → 60 |
| 4.2 | RLS Write Hardening | 60 → 48 |
| 4.3 | Storage Bucket Listing | 48 → 44 |
| 4.4 | Hardening final + HIBP | 44 → 42 |

**Redução total: 44%** (33 alertas eliminados). Os 42 restantes são exceções arquiteturais documentadas em `mem://constraints/security-linter-accepted-exceptions`.

### Próxima onda (proposta — não iniciada)

- ~~**Onda 5:** Auth hardening avançado — OTP expiry tuning, MFA obrigatório para platform admin, audit log de tentativas falhas.~~ ✅ **Encerrada em 2026-04-28** (ver seção abaixo).

---

## 2026-04-28 — Onda 5 — Auth Hardening Avançado (encerrada)

**Objetivo:** Fechar o ciclo de hardening iniciado nas Ondas 3 e 4, atacando vetores ligados ao login (e não mais ao banco).

### F1 — Audit Log de Tentativas de Login

- **Tabela:** `public.auth_login_attempts` (email, user_id, ip_address, user_agent, success, error_code, attempted_at).
- **Índices:** por email, ip_address, user_id e attempted_at — suportam contagem rápida em janelas curtas.
- **RLS:** ENABLE; SELECT só para `platform super_admin`; INSERT só por `service_role` via edge function `log-login-attempt`.
- **Edge function:** `log-login-attempt` (`verify_jwt = false`) — sanitiza email, captura IP via header padrão, persiste registro.
- **Front:** `Auth.tsx` chama a edge em todo `signInWithPassword`/`signUp`, sucesso ou falha.

### F2 — MFA Obrigatório para Platform Admin

- **Tabela:** `public.user_mfa_status`.
- **Hook:** `useRequireMFA` — verifica fator TOTP em `auth.mfa_factors` para roles `platform.super_admin` / `platform.admin`. Sem fator → redireciona para `/mfa/setup`.
- **Tela:** `MFASetup.tsx` (QR + verificação + códigos de recuperação).

### F3 — OTP Expiry Tuning

- OTP de e-mail reduzido de 60min para 10min via `configure_auth`. Janela suficiente para uso legítimo, hostil a ataques tardios.

### Validação técnica

- ✅ Tentativas visíveis em `auth_login_attempts` em tempo real
- ✅ Platform admins sem MFA são redirecionados no próximo login
- ✅ Linter Supabase: 42 alertas (sem regressão)

### Aprendizado consolidado das Ondas 1–5

| Onda | Foco | Resultado |
|------|------|-----------|
| 1 | Observabilidade (banco/cron/filas) | Painel Saúde do Sistema operacional |
| 2 | Resiliência observável (WhatsApp + pagamentos órfãos) | 0 mensagens perdidas |
| 3 | Hardening `SECURITY DEFINER` | search_path fixo + REVOKE default |
| 4 | RLS, buckets, extensões, HIBP | 75 → 42 alertas (-44%) |
| 5 | Auth hardening (audit, MFA, OTP) | Vetor de login auditado e endurecido |

**Regra perene derivada:** Toda nova função `SECURITY DEFINER` exposta via API DEVE ter `SET search_path = public` + `REVOKE EXECUTE FROM PUBLIC, anon` + `GRANT EXECUTE TO <role específica>`. Toda nova RLS permissiva (`USING (true)`) precisa de justificativa no comentário da migration.

---

## 2026-04-28 — Onda 6 — Performance e Velocidade Percebida (em validação)

**Contexto:** Após Onda 4 estabilizar segurança e Onda 5 endurecer auth, o usuário relatou que a velocidade percebida do app continuava ruim mesmo após upgrade da instância de Lovable Cloud. Diagnóstico mostrou que o gargalo era 100% **frontend + cascata de auth**, não banco.

### Diagnóstico

| Sintoma | Causa raiz | Camada |
|---------|------------|--------|
| Refetch a cada troca de aba | `QueryClient` sem defaults (staleTime 0, refetchOnWindowFocus true) | Frontend / cache |
| Bundle inicial grande, login lento | `vite.config.ts` sem `manualChunks` (recharts/xyflow/tiptap no chunk principal) | Build |
| 200–400ms extras em todo bootstrap | `useAuth.loadUserData` fazia 3 round-trips (profile → roles → tenants) | Auth |

### F1 — Defaults globais do React Query (`src/App.tsx`)

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,           // dados frescos por 60s
      gcTime: 5 * 60 * 1000,          // cache em memória por 5min
      refetchOnWindowFocus: false,    // troca de aba não dispara refetch
      refetchOnReconnect: true,       // voltar de offline sim
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});
```

**Regra:** Telas que precisem de dados sempre frescos sobrescrevem localmente com `staleTime: 0` ou `refetchInterval`. **Nunca voltar o default global a 0** — anula o ganho.

### F2 — Bundle partitioning (`vite.config.ts`) — REVERTIDO 2026-04-28

**Tentativa inicial:** isolar libs grandes em chunks por categoria (react-vendor, charts-vendor, flow-vendor, editor-vendor, export-vendor, ui-vendor, etc.) via `manualChunks`.

**Regressão observada:** O app publicado (`app.comandocentral.com.br`) ficou com **tela totalmente em branco** após o deploy. Apesar do RPC `get_user_bootstrap` responder 200 e o `useAuth` funcionar, a inicialização do React quebrou silenciosamente — provavelmente porque `manualChunks` separou módulos que dependem de ordem de inicialização compartilhada (Radix + react-dom + provider tree).

**Decisão:** Reverter `manualChunks` por completo. Manter apenas `chunkSizeWarningLimit: 1500` e `optimizeDeps.include` para acelerar dev. O Rollup faz split natural por entry/dynamic-import — que já é bom — e os ganhos reais da Onda 6 vêm das **outras 2 frentes** (cache global + bootstrap RPC).

**Regra anti-regressão (CRÍTICA):** Nunca aplicar `manualChunks` agressivo em SPAs com Radix UI + lazy routes sem teste obrigatório no app **publicado** (não só no preview). O preview do Lovable usa servir local que mascara problemas de ordem de carregamento que só aparecem em CDN com chunks segmentados. Se for tentar de novo no futuro, fatiar **uma categoria por vez** e validar publicado entre cada uma.

### F3 — Bootstrap unificado de auth (RPC)

Função `public.get_user_bootstrap()` retorna `{ profile, roles, tenants }` em **uma única chamada**. `useAuth.loadUserData` agora:

1. Tenta o RPC unificado.
2. Em erro (deploy em curso etc.), cai no caminho clássico paralelo.

Padrão segue Onda 3.4: `SECURITY DEFINER` + `SET search_path = public` + `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated`.

### Validação técnica executada

- ✅ Migration aplicada — `pg_proc` confirma `prosecdef=true`, `provolatile=s`, `proconfig=[search_path=public]`
- ✅ Linter Supabase estável (43 alertas; nova função enquadrada como exceção autenticada documentada)
- ✅ `useAuth` com fallback paralelo — sem regressão se o RPC falhar
- ⏳ **Pendente de validação do usuário:** percepção de velocidade no app publicado (`app.comandocentral.com.br`) após o próximo build/deploy

### Como o usuário valida

1. Acessar `app.comandocentral.com.br`, fazer login.
2. Navegar Pedidos → Produtos → Clientes → Dashboard várias vezes.
3. **Esperado:** segunda visita à mesma aba é instantânea (cache de 60s).
4. Trocar de aba do navegador e voltar → **sem loading**.
5. Tempo de login deve cair perceptivelmente.

### Regras perenes derivadas (anti-regressão)

1. **QueryClient global nunca volta a defaults zerados.** Necessidade pontual de dados frescos = override local.
2. **`manualChunks` agressivo é PROIBIDO** em `vite.config.ts`. Tentativa de fatiar por categoria (react/charts/flow/editor/ui/etc.) causou tela em branco no app publicado em 2026-04-28 mesmo funcionando no preview. Deixar o Rollup fazer split natural por entry e dynamic-import. Se for tentar de novo, fatiar **uma categoria por vez** e validar **no domínio publicado**, não no preview.
3. **Bootstraps de contexto crítico** (auth, tenant, permissões) devem ser sempre 1 round-trip via RPC. Adicionar nova entidade ao bootstrap = estender `get_user_bootstrap`, não criar nova chamada paralela.


---

## Auth — Tratamento de refresh token expirado (`bad_jwt`)

### Sintoma

Logs de auth do projeto mostravam, a cada 5 minutos, eventos do tipo:

```
GET /user → 403  error_code=bad_jwt  msg="invalid claim: missing sub claim"
referer: <URL pública do app>
```

Ocorria em visitantes com tokens antigos persistidos no `localStorage`. O Supabase JS dispara `autoRefreshToken` em loop e falha em todas as tentativas, gerando ruído permanente nos logs e chamadas de rede inúteis.

### Causa

O cliente Supabase guarda o `refresh_token` no storage. Quando esse token foi revogado/expirou (rotação de chaves, troca de projeto, sessão muito antiga), o GoTrue continua tentando renová-lo de 5 em 5 min e nunca limpa o storage sozinho.

### Correção

Em `src/hooks/useAuth.tsx`:

1. **`onAuthStateChange`** — quando o evento `TOKEN_REFRESHED` chega com `session === null`, isso significa que o refresh falhou em definitivo. Disparar `supabase.auth.signOut({ scope: 'local' })` para apagar o token podre do storage e zerar o estado local. Escopo `'local'` é mandatório — não revoga sessão de outros dispositivos.
2. **`getSession()` inicial** — se o callback retornar `error`, mesma ação: `signOut({ scope: 'local' })` e estado limpo. Sem isso, o GoTrue mantém o refresh quebrado e reinicia o ciclo.

### Regra perene (anti-regressão)

- Toda inicialização de `useAuth` (bootstrap + listener) **deve** tratar falha de refresh limpando o storage local. Sem isso, qualquer sessão antiga gera 403 contínuo.
- **Nunca** usar `signOut()` sem `scope` nesse caminho — mataria sessões válidas em outras abas/dispositivos.
- Se um dia for adicionado outro client Supabase (edge, worker, segundo schema), aplicar o mesmo padrão.

---

## 2026-04-28 — Cron `pg_cron` com `current_setting('app.settings.service_role_key')` ausente

### Sintoma

Job `ads-experiments-run` (jobid antigo 6) falhava silenciosamente toda terça às 11h desde fev/2026. Erro de auth ao chamar a edge function.

### Causa

O cron usava `'Bearer ' || current_setting('app.settings.service_role_key')`. A GUC **não existe** neste projeto (`current_setting(..., false)` lança exceção; `current_setting(..., true)` retorna NULL → header `Bearer ` vazio).

### Correção

Reagendado com **anon key hardcoded** no header — mesmo padrão dos jobs saudáveis (`scheduler-tick-job`, `ads-autopilot-analyze`, `ads-weekly-insights`). Validação: `net.http_post` manual retornou `200 {"success":true}`.

### Regra perene (anti-regressão)

- **Proibido** usar `current_setting('app.settings.service_role_key')` em `cron.schedule` neste projeto. A GUC nunca foi provisionada.
- Padrão obrigatório: anon key hardcoded no header (validação real do papel acontece dentro da edge function).
- Referência canônica: `scheduler-tick-job`.

---

## 2026-04-28 — Login OAuth (Google) não registrava em `auth_login_attempts`

### Sintoma

`auth_login_attempts` registrava só logins por e-mail/senha. Logins via Google ficavam invisíveis, comprometendo a auditoria da Onda 5 F1.

### Causa

A tela `/auth` chama `lovable.auth.signInWithOAuth('google', ...)` direto, sem passar por `useAuth.signInWithGoogle`. O sucesso real do OAuth só chega após o redirect (evento `SIGNED_IN` no `onAuthStateChange`), que não chamava `log-login-attempt`.

### Correção

Em `src/hooks/useAuth.tsx`, dentro do `onAuthStateChange`: quando `event === 'SIGNED_IN'` e `user.app_metadata.provider !== 'email'`, disparar `log-login-attempt` (fire-and-forget). Login por e-mail/senha continua logado em `signIn()` — sem duplicidade.


---

## 2026-04-28 — Auth: flicker da tela de login no callback OAuth Google

### Sintoma

Após login com Google, o usuário via a tela de login renderizar **vazia por 1-2s** entre o retorno do Google e o redirect para a home.

### Causa

Combinação de 3 fatores:

1. O latch `auth_page_rendered` em `Auth.tsx` (e o equivalente `__globalInitialLoadComplete` em `ProtectedRoute.tsx`) é ligado na primeira visita a `/auth`. Quando o usuário volta do Google, o latch já está ativo → o spinner de bootstrap é pulado → tela de login renderiza enquanto `loadUserData` ainda está rodando.
2. `Auth.tsx` chamava `lovable.auth.signInWithOAuth` direto, contornando `useAuth.signInWithGoogle` (violava a regra anti-regressão do item anterior — fonte única).
3. Não existia sinal estável de "OAuth em curso" sobrevivendo à remontagem do React após o redirect.

### Correção

Aplicação consistente de **dois padrões já consolidados** na própria base técnica:

- **§4.5 — Lado emissor + lado receptor** (`useCheckoutLinkLoader`): toda operação que sai do app via redirect precisa de uma guarda explícita no destino.
- **§10.6 — Sinal estável que sobrevive a re-renders** (blocos do Builder com cache do React Query): estado de operação em curso precisa viver fora do ciclo de render.

Mudanças:

1. **`src/hooks/useAuth.tsx`** — Helpers de módulo `markOAuthInProgress()` / `clearOAuthInProgress()` / `isOAuthInProgress()`. Bandeira em `localStorage.oauth_in_progress` com timestamp e timeout de segurança de 60s (anti-abandono). Limpeza determinística em todos os pontos de conclusão do bootstrap (sucesso, erro, sem sessão) e em `signOut()`.
2. **`signInWithGoogle(intent)`** virou **fonte única** consumindo `lovable.auth.signInWithOAuth` (Lovable Cloud). Encapsula `oauth_intent` (`'login' | 'signup'`) — não fica mais espalhado no código de tela.
3. **`src/pages/Auth.tsx`** — Handlers `handleGoogleLogin` / `handleGoogleSignup` passam a delegar a `useAuth.signInWithGoogle`. Gate do loader virou: `if ((authLoading && !initialRenderComplete) || isOAuthInProgress())`.
4. **`src/components/auth/ProtectedRoute.tsx`** — Mesmo gate adicional para blindar caso de `redirect_uri` apontar para rota protegida.

### Validação técnica

- `rg` confirma fonte única: 1 único caller de `lovable.auth.signInWithOAuth` em todo `src/`, dentro de `useAuth.tsx`.
- `tsc --noEmit -p tsconfig.app.json` → sem erros.
- Helpers exportados consumidos em `Auth.tsx` e `ProtectedRoute.tsx`.

### Regra perene (anti-regressão)

- **Toda chamada OAuth (qualquer provider)** deve passar por `useAuth.signInWithGoogle` (ou método análogo no mesmo hook). **Proibido** chamar `lovable.auth.signInWithOAuth` diretamente em código de tela.
- **Toda operação que sai do app via redirect** deve ter um sinal estável (storage com timestamp + timeout) controlado pela fonte única e consumido pelos gates de loader das rotas envolvidas. Padrão §4.5 + §10.6.
- **Latches genéricos anti-remontagem** (Google Tradutor, etc.) **não podem atropelar** estados de operação assíncrona em curso — o gate deve combinar `(latch desligado) OR (operação em curso)`.
- **Novos providers OAuth** (Apple, etc.) reaproveitam o mesmo método de `useAuth` e os mesmos helpers de bandeira — nunca duplicar.

