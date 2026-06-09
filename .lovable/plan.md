# Plano — Dashboard por Canal + Separação Loja × Marketplaces (v2026-06-09 rev2)

## Entendimento confirmado
- **Aba Geral**: visão consolidada — receita real = loja + todos marketplaces; investimento = Meta + Google + TikTok Ads (Ads internos de marketplace ficam como pendente declarado).
- **Gestor de Tráfego**: continua "geral" porém **sem marketplaces**. Vamos rotular isso com clareza e padronizar a janela de período com o Dashboard.
- **Aba Loja Virtual**: receita só da loja + gasto só nas plataformas de anúncio.
- **Abas Mercado Livre / Shopee / TikTok**: receita só do respectivo canal. Visíveis **apenas se a conexão estiver ativa**. São **resumo financeiro** com botão "Ver detalhes" para o módulo dedicado do marketplace (sem duplicar a gestão que já existe lá).
- **Pedidos de Venda**: continuam no mesmo lugar, mas com **ícone/etiqueta da origem** (Loja, ML, Shopee, TikTok) e **filtro por canal**.

## Contexto técnico já existente (reaproveitar, não recriar)
- Campo de canal no pedido: `sales_channel` (default `storefront`) + `marketplace_source` (ML/shopee/tiktok_shop). Índices já existem. **Não precisa migração de dados.**
- Critério de "ativo": `marketplace_connections.is_active = true` para o marketplace correspondente. Já consultado em outros pontos do sistema.
- "Venda realizada" definida no doc de Relatórios: `paid | processing | ready_to_invoice | shipped | delivered`. Reutilizar sem mudar.

## Diagnóstico atual
1. O Dashboard mistura loja + marketplaces sem separação visual, e o investimento já vem só de plataformas (sem rótulo da fonte).
2. Gestor de Tráfego usa janela de período diferente e exibe "Receita" do pixel da Meta (atribuída), enquanto o Dashboard usa receita real de caixa — divergência aparente entre os dois.
3. Pedidos de Venda não mostram canal de origem nem filtram por canal, apesar do dado existir.
4. No tenant Respeite o Homem hoje: 100% das vendas são da loja virtual (599 pedidos `storefront`, 0 marketplace, ML inativo). Implementação fica pronta para quando marketplaces forem ativados.

## O que será entregue

### Onda 1 — Abas no Dashboard da Central de Comando
Estrutura:
```text
Central de Comando › Dashboard
 ├─ Geral          (sempre visível)
 ├─ Loja Virtual   (sempre visível)
 ├─ Mercado Livre  (só se conexão ML ativa)
 ├─ Shopee         (só se conexão Shopee ativa)
 └─ TikTok         (só se conexão TikTok Shop ativa)
```

Comportamento:
- Mesmo grid de métricas + mesmo Preview de Vendas, filtrados pela origem.
- Cada card ganha um **selo discreto de fonte** ("Caixa real", "Meta/Google/TikTok Ads") para acabar com a confusão atual.
- Abas de marketplace exibem botão **"Ver detalhes no módulo"** levando para `/marketplaces/{nome}` — não duplicam a gestão existente.
- Ads internos de marketplace: card com selo **"Em breve"** (lacuna documental declarada).

| Aba            | Receita considera                | Investimento considera                          |
|----------------|----------------------------------|--------------------------------------------------|
| Geral          | Loja + todos marketplaces        | Plataformas (Meta/Google/TikTok Ads)             |
| Loja Virtual   | Só pedidos da loja               | Plataformas (Meta/Google/TikTok Ads)             |
| Mercado Livre  | Só pedidos do ML                 | "Em breve" (Ads do ML — pendente)                |
| Shopee         | Só pedidos da Shopee             | "Em breve" (Ads da Shopee — pendente)            |
| TikTok         | Só pedidos do TikTok Shop        | TikTok Ads (já existe) + "Em breve" Shop Ads     |

### Onda 2 — Alinhamento do Gestor de Tráfego
- Padronizar janela de período (mesmo cálculo BRT do Dashboard) → investimento bate entre os dois módulos.
- Renomear "Receita" para **"Receita atribuída (Meta/Google/TikTok)"** e exibir, ao lado, **"Receita Real da loja virtual"** vinda da mesma fonte do Dashboard.
- Nota fixa no topo: *"Este módulo considera apenas plataformas de anúncio e loja virtual. Marketplaces são analisados no Dashboard."*

### Onda 3 — Pedidos de Venda
- **Ícone/etiqueta de origem** em cada linha (Loja, ML, Shopee, TikTok).
- **Filtro multi-seleção por canal** no topo da lista.
- Não altera regra fiscal/operacional. Só leitura e filtro.

### Onda 4 — Documentação e anti-regressão
- Atualizar `docs/especificacoes/sistema/central-comando.md` (nova estrutura de sub-abas + selos de fonte + critério de visibilidade).
- Atualizar `docs/especificacoes/marketing/gestor-trafego.md` (escopo "sem marketplaces" e relação com o Dashboard).
- Atualizar `docs/especificacoes/transversais/mapa-ui.md` (sub-abas da Central de Comando + ícone/filtro nos PVs).
- Registrar memória de anti-regressão (`mem://features/command-center/dashboard-by-channel-standard`): "Dashboard tem fontes rotuladas; abas de marketplace dependem de conexão ativa; Gestor de Tráfego é loja+plataformas, sem marketplaces."

## O que **não** entra (pendências declaradas)
- Coleta de investimento de anúncios **dentro** dos marketplaces (ML Ads, Shopee Ads, TikTok Shop Ads). Aparece como "Em breve". Vira tema próprio depois.
- Atribuição de pedidos de marketplace a campanhas (não há pixel nesses ambientes).

## Validação prevista antes de fechar (no tenant Respeite o Homem)
- Geral = loja + qualquer pedido marketplace que existir.
- Loja Virtual bate com a tela atual (todos os 599 pedidos atuais).
- Abas de marketplace não aparecem (já que nenhuma conexão está ativa hoje). Forçar uma ativação de teste para validar o gating.
- Gestor de Tráfego e Dashboard mostram o **mesmo investimento** para o mesmo período.
- PVs trazem ícone e filtro por canal funcionando.

## Confirma que sigo nessa direção?
Execução em 4 ondas curtas, na ordem acima. Posso começar pela Onda 1 assim que confirmar.
