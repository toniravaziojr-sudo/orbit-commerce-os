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

---

## 11. Frete & Logística

### 11.1 Fretes aparecendo com valor zero

**Problema:** Opções de frete (PAC, Sedex, Loggi) apareciam mas com preço R$ 0,00.

**Causa raiz:** Das 3 integrações configuradas (Frenet, Correios, Loggi), apenas Frenet estava funcional. Correios falhava com 401 (credenciais OAuth2 expiradas) e Loggi falhava por payload incompleto (faltava endereço completo no formato `correiosAddress`).

**Solução:** Corrigir payload da Loggi, renovar credenciais Correios, e exibir alertas quando provedores de frete falham silenciosamente.

**Regra derivada:** Edge functions de cotação de frete devem logar claramente quando um provedor falha, em vez de retornar silenciosamente R$ 0,00.

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
