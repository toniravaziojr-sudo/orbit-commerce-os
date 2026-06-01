# Relatórios — Regras e Especificações

> **Status:** ✅ Ready
> **Última atualização:** 2026-06-01
> **Versão:** v1.0.0
> **Camada:** Layer 3 — Especificações / Sistema
> **Rota:** `/reports` (Utilitários › Relatórios — FeatureGated: `reports`)

---

## 1. Visão Geral

A página de Relatórios concentra a análise de vendas reais do tenant, com filtro de período padrão (BRT) e exportação CSV em todas as abas. Os gráficos seguem o design system (tokens HSL — proibido hex hardcoded) com visual minimalista.

Existem duas portas de entrada:

1. **Diretamente em `/reports`** — navegação por abas.
2. **A partir da Central de Comando › Dashboard → bloco "Preview de Vendas"** — os botões "Ver mais" deep-linkam para `/reports?tab=...&view=...`.

---

## 2. Fonte única de "venda realizada"

Toda métrica de vendas (no Dashboard e em Relatórios) considera **exclusivamente** pedidos com status:

```
('paid', 'processing', 'ready_to_invoice', 'shipped', 'delivered')
```

- `ready_to_invoice` **conta** como venda — é pós-pagamento. Omiti-lo esconde 100% das vendas em lojas que avançam o pedido direto para emissão fiscal após o pagamento.
- Cancelados, em análise, falhos e abandonados **não** entram.
- Período sempre em **BRT (America/Sao_Paulo)**, armazenado em UTC no banco.
- Receita: soma de `orders.total` (já em reais — nunca dividir por 100).
- Paridade obrigatória 1:1 entre o Dashboard (Preview de Vendas) e a aba correspondente em `/reports`.

Regra registrada também em `mem://constraints/dashboard-sales-preview-and-reports-source`.

---

## 3. Abas

| Aba | Param | Conteúdo |
|-----|-------|----------|
| Visão Geral | `overview` (default) | Resumo do período: receita, pedidos, ticket médio, evolução temporal. |
| Produtos | `products` | Top produtos vendidos (unidades + receita). Tabela completa + gráfico. |
| Pagamentos | `payments` | Vendas por forma de pagamento (Pix, cartão, boleto, etc.) — receita, pedidos, %. |
| Regiões | `regions` | Sub-toggle `?view=states\|cities`. Top estados e cidades com receita e pedidos. |
| Canais | `channels` | Origem do pedido (loja própria, marketplaces, link de checkout, etc.). |
| Cupons | `coupons` | Cupons utilizados, descontos concedidos, receita atribuída. |
| Afiliados | `affiliates` | Conversões por afiliado (join `affiliate_conversions` + `affiliates(name,email)`), receita e comissões. Valores convertidos de centavos para reais. |
| Clientes | `customers` | Novos clientes no período, recorrência, ticket médio por cliente. |
| GA4 | `ga4` | Painel de origem/mídia quando a integração GA4 está conectada. |

Deep links suportados a partir do Dashboard:
- `/reports?tab=products`
- `/reports?tab=payments`
- `/reports?tab=regions&view=states`
- `/reports?tab=regions&view=cities`

---

## 4. Bloco "Preview de Vendas" no Dashboard

Vive em `Central de Comando › Dashboard` (acima do grid de Pedidos Recentes). 4 cards Top 5:

| Card | Métrica | Visual | Link "Ver mais" |
|------|---------|--------|-----------------|
| Top 5 Produtos | Unidades vendidas + receita por produto | Lista compacta | `/reports?tab=products` |
| Top 5 Estados | Receita + nº de pedidos por UF | Barras horizontais (Recharts) | `/reports?tab=regions&view=states` |
| Top 5 Cidades | Receita + nº de pedidos por cidade | Barras horizontais (Recharts) | `/reports?tab=regions&view=cities` |
| Formas de Pagamento | Receita por método | Donut (Recharts) + legenda com % | `/reports?tab=payments` |

Regras visuais:
- Cores via tokens HSL do design system (`hsl(var(--primary))`, `hsl(var(--accent))`, `hsl(var(--chart-2))`, etc.). **Hex hardcoded é proibido.**
- Estados de skeleton e empty padronizados.
- Mesmo filtro de período do restante do Dashboard.

---

## 5. Exportação

Todas as abas oferecem botão **Exportar CSV** sobre o conjunto filtrado atual. O arquivo respeita o período BRT selecionado.

---

## 6. Permissão

A rota `/reports` é protegida por `FeatureGated: reports`. Tenants sem o recurso veem badge "Upgrade" no item de menu (Utilitários › Relatórios) e bloqueio com CTA de upgrade ao acessar.

---

## 7. Anti-regressão

- A regra de status de "venda realizada" (§2) é fonte única para Dashboard e Relatórios. Qualquer divergência indica bug e deve voltar ao diagnóstico.
- Não voltar a exibir "Saúde do WhatsApp" no Dashboard — vive em Integrações.
- Não introduzir cores fixas (hex) nos gráficos; sempre via tokens.

---

## 8. Referências

- `docs/especificacoes/sistema/central-comando.md` — Estrutura do Dashboard e Preview de Vendas.
- `docs/especificacoes/transversais/mapa-ui.md` — Rota e gating.
- `mem://constraints/dashboard-sales-preview-and-reports-source` — Regra anti-regressão.
