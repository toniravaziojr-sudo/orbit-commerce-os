

# Plano: Sistema de Tooltips Informativos para toda a UI

## Resumo

Criar um sistema centralizado de textos de ajuda (tooltips) que aparece como "balão" ao manter o mouse sobre botões, ícones e funcionalidades por 1 segundo, explicando o que cada elemento faz. O sistema será baseado num arquivo de configuração único com todas as descrições, um componente wrapper reutilizável, e documentação completa.

## O que será feito

### 1. Criar arquivo de configuração central de tooltips
Um único arquivo (`src/config/ui-tooltips.ts`) com todas as descrições organizadas por módulo/página. Isso permite editar textos sem mexer em componentes.

Exemplo de estrutura:
- **Sidebar**: cada item do menu terá uma descrição curta do módulo
- **Botões de ação**: "Novo Pedido", "Exportar CSV", "Importar", etc.
- **Tabs**: cada aba em páginas como Central de Comando, Pedidos, Logística
- **Filtros e controles**: seletores de status, datas, busca
- **Cards informativos**: StatCards no dashboard, métricas
- **Header**: menu do usuário, toggle de modo admin

### 2. Criar componente `InfoTooltip`
Componente wrapper reutilizável que:
- Usa `delayDuration={1000}` (1 segundo) para aparecer
- Visual de "balão" com estilo diferenciado (fundo escuro, seta, max-width)
- Aceita `tooltipKey` (busca no config) ou `content` direto
- Opcionalmente mostra ícone de "?" (info) ao lado do elemento

### 3. Aplicar tooltips em todas as páginas principais

**Sidebar (~40 itens)**: Descrição curta de cada módulo ao passar o mouse no item do menu (já existe para sidebar colapsada, expandir para sidebar aberta também).

**Central de Comando (5 tabs)**:
- Dashboard: "Visão geral de métricas e indicadores do dia"
- Central de Execuções: "Fila de tarefas pendentes e automações em andamento"
- Insights: "Sugestões inteligentes baseadas nos dados da loja"
- Assistente: "Chat com IA para tirar dúvidas e executar ações"
- Agenda: "Calendário de tarefas, compromissos e lembretes"

**Pedidos**: botões Novo Pedido, Exportar, Importar, filtros de status/pagamento/envio, StatCards

**Produtos**: botão Novo Produto, Importar, filtros

**Clientes**: botão Novo Cliente, Tags, Importar, Exportar, filtros

**Descontos**: botão Novo Cupom, filtros de status

**Marketing**: tabs Integrações, Catálogos, Relatórios

**Email Marketing**: botões de criar lista, template, campanha, automação

**Logística**: tabs Remessas, Transportadoras, Frete Grátis, Regras Customizadas

**Financeiro, Fiscal, Blog, Avaliações, Notificações, Configurações** — botões de ação e seções principais

**Header**: ícone do usuário, item "Dados da Conta", "Planos e Faturamento"

### 4. Documentar no Layer 3
Criar seção "Tooltips Informativos" no doc `docs/especificacoes/transversais/padroes-ui.md` com:
- Padrão de implementação
- Referência ao arquivo de configuração central
- Regras: delay de 1s, max 120 caracteres, linguagem de negócio

## Detalhes técnicos

### Arquivos a criar
| Arquivo | Descrição |
|---------|-----------|
| `src/config/ui-tooltips.ts` | Mapa centralizado `Record<string, string>` com ~120 textos |
| `src/components/ui/info-tooltip.tsx` | Componente wrapper com delay 1s |

### Arquivos a modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Adicionar tooltip descritivo em cada item (sidebar aberta) |
| `src/pages/CommandCenter.tsx` | Tooltip em cada TabsTrigger |
| `src/pages/Orders.tsx` | Tooltip nos botões de ação e filtros |
| `src/pages/Products.tsx` | Tooltip nos botões |
| `src/pages/Customers.tsx` | Tooltip nos botões e filtros |
| `src/pages/Discounts.tsx` | Tooltip nos botões |
| `src/pages/Marketing.tsx` | Tooltip nas tabs |
| `src/pages/EmailMarketing.tsx` | Tooltip nos botões |
| `src/pages/Shipping.tsx` | Tooltip nas tabs e botões |
| `src/pages/Settings.tsx` | Tooltip nos cards |
| `src/components/layout/AppHeader.tsx` | Tooltip nos itens do menu |
| `docs/especificacoes/transversais/padroes-ui.md` | Nova seção documentando o padrão |

### Componente InfoTooltip — assinatura
```tsx
interface InfoTooltipProps {
  tooltipKey?: string;    // busca texto no ui-tooltips.ts
  content?: string;       // texto direto (override)
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  showIcon?: boolean;     // mostra ícone "?" ao lado
}
```

### Comportamento
- **Delay**: 1000ms (aparece após 1s com mouse parado)
- **Desaparece**: imediatamente ao retirar o mouse
- **Estilo**: fundo escuro, texto branco, border-radius, seta apontando para o elemento
- **Max-width**: 280px para textos mais longos
- **Não interfere** com tooltips já existentes na sidebar colapsada

