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
2. Para efeitos de inicialização (carregar dados do DB uma única vez), usar `useRef` como flag:
   ```tsx
   const initialized = useRef(false);
   useEffect(() => {
     if (initialized.current) return;
     if (data.length === 0) return;
     initialized.current = true;
     // ... inicializar estado local
   }, [data]);
   ```

**Onde ocorreu:** `PaymentSettingsTab.tsx` — Configurações de Pagamento (abril/2026).

**Regra derivada:** Todo array/objeto criado no corpo de um componente e usado como dependência de `useEffect` DEVE ser memoizado com `useMemo`.

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

