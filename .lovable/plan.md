

# Plano: Modo Vendas por IA no WhatsApp (Comércio Conversacional)

## Resumo

Transformar a IA de suporte (atualmente informativa) em um agente de vendas conversacional, capaz de buscar produtos, oferecer cupons, montar carrinho, sugerir ofertas de aumento de ticket e gerar link de checkout pré-preenchido — tudo dentro do WhatsApp. Controlado por um toggle "Modo Vendas" nas configurações de IA.

---

## O que já existe

- **Edge Function `ai-support-chat`**: IA de suporte com RAG, classificação de intenção, regras, knowledge base e envio via WhatsApp
- **Tabela `ai_support_config`**: Configurações de personalidade, modelo, guardrails
- **Tabela `products`**: Catálogo completo com preço, estoque, slug
- **Tabela `discounts`**: Cupons com limites de uso, validade, valor mínimo
- **Tabela `discount_redemptions`**: Controle de uso por cliente
- **Tabela `checkout_links`**: Links de checkout com produto, cupom, override de preço
- **Tabela `offer_rules`**: Regras de upsell/order bump (cross-sell, aumento de ticket)
- **Tabela `customers`**: Cadastro completo com métricas (total gasto, tier, pedidos)
- **Integração WhatsApp Meta Cloud API**: Webhook + envio funcionando

## O que falta

1. **Flag `sales_mode_enabled`** na tabela `ai_support_config`
2. **Ferramentas (tools) de vendas** na Edge Function para a IA executar ações
3. **Lógica de carrinho conversacional** vinculada à conversa
4. **Geração automática de checkout link** com dados do cliente pré-preenchidos
5. **Toggle na UI** de configurações de IA
6. **Prompt de vendas** condicional (substituindo os guardrails informativos)

---

## Etapas de Implementação

### Etapa 1 — Migração DB + Toggle UI

**Migração SQL:**
- Adicionar coluna `sales_mode_enabled BOOLEAN DEFAULT false` em `ai_support_config`
- Criar tabela `whatsapp_carts` para estado de carrinho por conversa:
  - `id`, `conversation_id`, `tenant_id`, `customer_id`, `items JSONB`, `coupon_code`, `subtotal`, `status` (active/converted/abandoned), `expires_at`, `created_at`, `updated_at`

**UI (tela de configurações da IA):**
- Adicionar toggle "Modo Vendas" com descrição explicativa
- Quando ativado, mostrar sub-opções: habilitar sugestões de upsell, permitir cupons automáticos

### Etapa 2 — Tools de Vendas na Edge Function

Implementar **OpenAI Function Calling** (tools) no `ai-support-chat`. Quando `sales_mode_enabled = true`, a IA recebe ferramentas adicionais:

| Tool | O que faz |
|------|-----------|
| `search_products` | Busca produtos por nome/categoria (usa `search_products_fuzzy` existente) |
| `get_product_details` | Retorna preço, estoque, descrição, imagens de um produto |
| `check_coupon` | Valida cupom: ativo, dentro da validade, limite de uso, valor mínimo |
| `check_customer_coupon_eligibility` | Cruza cliente + cupom (verifica `discount_redemptions`) |
| `add_to_cart` | Adiciona produto ao carrinho da conversa (`whatsapp_carts`) |
| `view_cart` | Mostra itens no carrinho atual |
| `remove_from_cart` | Remove item do carrinho |
| `apply_coupon` | Aplica cupom ao carrinho |
| `check_upsell_offers` | Verifica `offer_rules` ativas baseado no carrinho atual |
| `generate_checkout_link` | Cria registro em `checkout_links` com produtos + cupom + dados do cliente |
| `lookup_customer` | Consulta cadastro do cliente (já existe parcialmente no código) |

### Etapa 3 — Prompt Condicional de Vendas

Quando `sales_mode_enabled = true`:
- Substituir `INFORMATIVE_GUARDRAILS` por `SALES_AGENT_PROMPT` que instrui a IA a:
  - Identificar intenção de compra
  - Sugerir produtos relevantes usando as tools
  - Oferecer cupons quando disponíveis
  - Montar carrinho progressivamente
  - Sugerir upsells quando requisitos forem atingidos
  - Gerar link de checkout ao final com dados pré-preenchidos
  - Nunca forçar venda, manter tom consultivo
- Manter guardrails de segurança (não inventar preços, respeitar estoque)

### Etapa 4 — Geração de Checkout Link Pré-preenchido

Quando a IA chamar `generate_checkout_link`:
1. Criar registro em `checkout_links` com produto(s), cupom e override se aplicável
2. Construir URL do checkout da loja com query params do cliente:
   - `?name=X&email=Y&phone=Z&cpf=W` (dados já conhecidos da conversa/cadastro)
3. Retornar o link para a IA enviar ao cliente via mensagem
4. O cliente clica, chega no checkout com tudo preenchido, só finaliza

### Etapa 5 — Métricas e Conversão

- Rastrear conversões originadas do carrinho WhatsApp (`whatsapp_carts.status = converted`)
- Vincular `checkout_links.conversion_count` com pedidos efetivados
- Log em `conversation_events` para cada ação de venda (produto sugerido, cupom aplicado, link gerado)

---

## Detalhes Técnicos

```text
Fluxo da Mensagem (com Modo Vendas):

Cliente envia mensagem
  → meta-whatsapp-webhook
    → ai-support-chat
      → Classificação de intenção (inclui "purchase_intent")
      → Se sales_mode_enabled:
        → Injeta SALES_AGENT_PROMPT + tools de vendas
        → OpenAI responde com tool_calls
        → Edge Function executa tools (busca produto, valida cupom, etc.)
        → Retorna resultado para a IA
        → IA formula resposta conversacional
      → Salva mensagem + envia via WhatsApp
```

**Arquivos impactados:**
- `supabase/functions/ai-support-chat/index.ts` — tools de vendas + prompt condicional
- `src/hooks/useAiSupportConfig.ts` — novo campo `sales_mode_enabled`
- `src/components/support/` — toggle na UI de configurações
- Migração SQL — nova coluna + tabela `whatsapp_carts`

**Segurança:**
- Tools executam com `service_role` (já é o caso da Edge Function)
- Validação de estoque em tempo real antes de adicionar ao carrinho
- Cupons validados contra `discount_redemptions` para evitar abuso
- Carrinho expira automaticamente (24h default)

