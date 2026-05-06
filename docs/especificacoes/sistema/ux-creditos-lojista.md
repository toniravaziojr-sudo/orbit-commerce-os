# UX de Créditos — Lojista (Tenant)

> **Camada:** Layer 3 — Especificação Funcional  
> **Status:** Especificação futura (UI ainda não implementada)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** experiência do lojista em torno de créditos — saldo, compra, extrato de uso, estimador, alertas e regras de visibilidade.

---

## 1. Hub principal

**Rota oficial:** `/account/credits`

Hub único para todas as interações do lojista com o sistema de créditos. Substitui (futuramente) `/ai-packages`. Não duplica `/account/billing`, que mantém foco em plano e faturas da assinatura.

## 2. Estrutura de abas

| Aba | Caminho | Conteúdo |
|---|---|---|
| **Visão geral** | `/account/credits` (default) | Saldo atual, gasto do mês, gráfico de consumo por categoria, alertas de saldo, atalhos. |
| **Comprar créditos** | `/account/credits?tab=buy` | Pacotes disponíveis (`credit_packages`), comparativo, checkout. |
| **Extrato de uso** | `/account/credits?tab=ledger` | **Histórico completo de gastos do tenant.** |
| **Estimador** | `/account/credits?tab=estimator` | Calculadora: lojista escolhe feature/categoria + quantidade e vê custo estimado em créditos e R$. |

**Decisão registrada:** o histórico de gastos de créditos do tenant fica em `/account/credits?tab=ledger`. Não fica em `/account/billing`, não fica em `/platform/*`, não fica em `/ai-packages`.

## 3. Aba "Visão geral"

- **Card de saldo:** créditos disponíveis (`balance_credits - reserved_credits`), créditos reservados (com tooltip explicando), gasto no mês, comparativo com mês anterior.
- **Gráfico de consumo por categoria** (últimos 30 dias): IA, fiscal, e-mail, WhatsApp, scrape.
- **Alertas de saldo** (banner topo da aba, persistente até resolver):
  - **80% do consumo médio mensal projetado:** banner amarelo informativo.
  - **95%:** banner laranja com CTA "Comprar créditos".
  - **100% / saldo insuficiente:** banner vermelho bloqueante com CTA principal.
- **Atalhos:** "Comprar créditos", "Ver extrato", "Estimar custo".

## 4. Aba "Extrato de uso"

### 4.1 Colunas mínimas

| Coluna | Conteúdo |
|---|---|
| Data/hora | Em BRT (America/Sao_Paulo). |
| Tipo de transação | `Compra` \| `Débito` \| `Reserva` \| `Captura` \| `Liberação` \| `Refund` \| `Ajuste` \| `Bônus`. |
| Categoria | IA Texto / IA Imagem / IA Vídeo / IA Áudio / Embeddings / Fiscal / E-mail / WhatsApp / Scrape. |
| Feature/módulo | Nome amigável do recurso (ex.: "Gerador de descrição", "NFe emitida", "Campanha de e-mail"). |
| Descrição | Texto humano (ex.: "Descrição gerada para o produto X", "NFe nº 12345"). |
| Créditos | +N (compra/refund/bônus) ou −N (débito) com cor. |
| Saldo após | Saldo de créditos após a operação. |
| Valor aproximado em R$ | `sell_brl_snapshot` da linha. Formatado em pt-BR. |
| Status | `Concluído` \| `Reservado` \| `Estornado` \| `Falha`. |
| Operação relacionada | Link para o objeto (pedido, NFe, campanha, conversa) quando aplicável. |

### 4.2 Filtros mínimos

- Período (preset: hoje, 7d, 30d, 90d, mês atual, mês anterior, custom).
- Categoria.
- Tipo de transação.
- Feature/módulo.
- Status.

### 4.3 Exportação

- Botão "Exportar CSV" no canto superior direito da tabela.
- CSV inclui as mesmas colunas exibidas + `idempotency_key` (para suporte).
- Limite: período máximo de 12 meses por export.

## 5. Aba "Comprar créditos"

- Lista de pacotes ativos (`credit_packages`) com nome, créditos base, bônus, total, preço em R$, custo por crédito.
- Badge "Mais popular" no pacote configurado.
- Botão "Comprar" inicia checkout via `credits-purchase-checkout` (já existente).
- Após pagamento confirmado, redirecionamento de volta a `/account/credits` com toast de sucesso.
- Histórico de compras visível na aba Extrato com tipo `Compra`.

## 6. Aba "Estimador"

- Seleção de categoria → seleção de feature → input de quantidade (ex.: "10 imagens HD", "1 vídeo de 30s", "500 e-mails").
- Mostra:
  - créditos estimados;
  - valor aproximado em R$;
  - tempo estimado de operação quando aplicável.
- **Não mostra** `cost_usd`, markup, margem ou detalhes do catálogo.
- Cálculo via RPC sanitizada (`estimate_credits()` — definida em Fase 1).

## 7. Chip de saldo no header global

- Componente persistente no header de toda rota autenticada do tenant.
- Exibe "X créditos" com ícone.
- Cores:
  - normal: cor neutra.
  - amarelo: <20% do consumo mensal projetado.
  - vermelho: saldo insuficiente para próxima operação típica.
- Click → navega para `/account/credits`.
- Tooltip ao hover: saldo disponível, reservado, gasto do mês.

## 8. Migração de rotas existentes

| Rota atual | Destino futuro |
|---|---|
| `/ai-packages` | Redirect 301 para `/account/credits?tab=buy`. Manter rota antiga ativa por 1 release antes de remover. |
| `/account/billing` | Mantém foco em plano/faturas da assinatura SaaS. **Etapa 1C Fase A3.2 (2026-05-06):** ganhou seção provisória "Extrato de Créditos" (cards Disponível/Reservado/Consumido + histórico via RPC `get_credit_history`, filtros período/tipo, paginação, mascaramento server-side de custo/margem). **Etapa 1C.1 (2026-05-06):** o bloco antigo "Uso de Créditos de IA" (`AIUsageBreakdown`) foi removido de Billing porque contradizia o Extrato; será reescrito futuramente como detalhamento real dentro de `/account/credits`. Linhas do extrato agora mostram "Categoria — Detalhe" (ex.: `IA Imagem — Fast Upgrade`). Quando `/account/credits` for entregue, esta seção será movida para `/account/credits?tab=ledger` e Billing voltará a ter apenas link "Saldo de créditos: X — gerenciar". |

## 9. Regras de visibilidade — o que o tenant **NÃO** vê

- `cost_usd` real do provedor.
- `markup_pct` aplicado.
- Margem absoluta ou percentual.
- Identificação do provedor externo (ex.: "OpenAI", "Fal", "Focus NFe") — apenas categoria amigável.
- Detalhes internos do catálogo de preços.
- Custos absorvidos pela plataforma (`cost_owner='platform'`).

## 10. Regras de visibilidade — o que o tenant **vê**

- Créditos consumidos por operação.
- Categoria amigável (ex.: "IA Imagem", não "fal-ai/flux-pro").
- Feature/módulo (ex.: "Estúdio de Criativos").
- Descrição humana da operação.
- Valor aproximado em R$ (do `sell_brl_snapshot`).
- Status e timestamp.
- Operação relacionada quando aplicável.

## 11. Mensagens em saldo insuficiente

Quando uma operação é bloqueada por saldo insuficiente:

```
Saldo insuficiente para esta operação.
Você precisa de 320 créditos. Saldo atual: 80.
[Comprar créditos] [Cancelar]
```

Sem termos técnicos. Sem códigos de erro visíveis. CTA leva direto para `/account/credits?tab=buy`.

## 12. Documentos relacionados

- `docs/especificacoes/plataforma/motor-creditos.md`
- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/transversais/mapa-ui.md`
