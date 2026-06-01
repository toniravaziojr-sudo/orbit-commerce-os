---
name: dashboard-sales-preview-and-reports-source
description: Central de Comando › Dashboard NÃO mostra Saúde do WhatsApp (vive em Integrações) e exibe bloco "Preview de Vendas" Top 5 (produtos/estados/cidades/pagamento). Os Top 5 do dashboard e os relatórios completos em /reports são calculados sobre o MESMO critério (pedidos com status paid/processing/shipped/delivered, BRT), garantindo paridade 1:1.
type: constraint
---
- Saúde do WhatsApp foi removida da Central de Comando › Dashboard. Continua disponível em Integrações › WhatsApp. Não re-adicionar.
- Dashboard tem bloco "Preview de Vendas" com 4 cards Top 5 e link "Ver mais" para `/reports?tab=products|payments` e `/reports?tab=regions&view=states|cities`.
- Fonte única de "venda realizada": pedidos com status em `('paid','processing','shipped','delivered')` no período em BRT. Mesma regra usada no dashboard e nos relatórios.
- A página `/reports` lê `?tab=` e `?view=` (Regiões: states|cities) para navegação direta a partir do dashboard.
- Aba Afiliados em `/reports?tab=affiliates` lê `affiliate_conversions` (centavos → reais) com join em `affiliates(name,email)`.
- Paleta dos gráficos usa tokens HSL do design system (`hsl(var(--primary))`, `--accent`, etc.) — proibido hex hardcoded.
