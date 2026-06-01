# Plano — Central de Comando enxuta + Relatórios de Vendas confiáveis

## Objetivo
1. Remover o card "Saúde do WhatsApp" da Central de Comando › Dashboard (continua em Integrações).
2. Adicionar bloco "Preview de Vendas" com 4 Top 5 (produtos, estados, cidades, formas de pagamento) e link "Ver mais" para o relatório completo.
3. Reformar Utilitários › Relatórios com dados reais, abas organizadas e visual minimalista.

## Escopo aprovado
- Mudanças de UI: só as listadas acima.
- Sem mexer em backend de WhatsApp, integrações, fiscal, fluxo de pedidos.
- Sem nova tabela/edge function — leitura sobre dados existentes (pedidos, itens, cupons, conversões de afiliado, endereço de entrega, forma de pagamento).

## Etapas de execução
1. **Dashboard**: remover card e injetar bloco "Preview de Vendas" (4 cards, mesmo filtro de período).
2. **Relatórios**: reorganizar abas (Visão Geral, Produtos, Pagamentos, Regiões com sub-abas Estados/Cidades, Canais, Cupons, Afiliados, Clientes, GA4), padronizar gráficos minimalistas, garantir export CSV em todas.
3. **Validação técnica**: comparar somas (receita total × somatório por pagamento × por estado × por canal) no banco e conferir que Top 5 do dashboard = Top 5 do relatório.
4. **Documentação**: atualizar doc oficial da Central de Comando, criar doc oficial de Relatórios e atualizar `mapa-ui.md`.

## Critério de fechamento
- Build limpo, sem erro de console.
- Soma das partes bate com o total no mesmo período.
- Docs atualizados ou lacuna declarada.
- Memória anti-regressão curta: "Saúde do WhatsApp não aparece na Central de Comando — vive em Integrações."
