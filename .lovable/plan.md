

## Plano: Redesenho do Fluxo de Criação de Anúncios ML

### Problema Atual
O wizard atual (`MeliListingWizard`) só suporta **um produto por vez**. Para anunciar 50 produtos, o lojista precisa repetir o processo 50 vezes. As configurações padrão (tipo de anúncio, condição, frete) precisam ser escolhidas individualmente toda vez.

### Novo Fluxo Proposto

```text
┌──────────────────────────────────────────────────────┐
│  ETAPA 1: Selecionar Produtos                        │
│                                                      │
│  [Busca por nome/SKU]                                │
│  ☑ Selecionar todos (23 disponíveis)                 │
│                                                      │
│  ☑ Produto A  -  R$ 49,90  -  SKU: ABC123           │
│  ☑ Produto B  -  R$ 89,90  -  SKU: DEF456           │
│  ☐ Produto C  -  R$ 29,90  -  SKU: GHI789           │
│                                                      │
│  2 produtos selecionados                             │
│                                        [Continuar →] │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ETAPA 2: Configurações Padrão                       │
│                                                      │
│  Tipo de Anúncio:   [Clássico ▾]                     │
│  Condição:          [Novo ▾]                         │
│  Frete Grátis:      [  ON  ]                         │
│  Retirada Local:    [  OFF ]                         │
│                                                      │
│  ☑ Gerar títulos otimizados via IA                   │
│  ☑ Gerar descrições via IA                           │
│  ☑ Auto-categorizar via ML                           │
│                                                      │
│  [← Voltar]                          [Criar Anúncios]│
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ETAPA 3: Processamento (se IA ativada)              │
│                                                      │
│  Processando 2 de 5 produtos...                      │
│  ████████░░░░░░░░░░ 40%                              │
│                                                      │
│  ✓ Produto A - título, descrição, categoria          │
│  ⟳ Produto B - gerando título...                     │
│  ○ Produto C - aguardando                            │
│                                                      │
│  Ao concluir, os anúncios aparecem como rascunhos    │
│  na tabela para revisão individual.                  │
└──────────────────────────────────────────────────────┘
```

### Mudanças Técnicas

**1. Substituir `MeliListingWizard.tsx` por `MeliListingCreator.tsx`**
- Dialog em tela cheia (`max-w-3xl`)
- Etapa 1: Lista de produtos com checkboxes e multi-seleção, busca, "selecionar todos"
- Etapa 2: Configurações padrão que se aplicam a todos os produtos selecionados:
  - `listing_type` (Clássico/Premium/Grátis)
  - `condition` (Novo/Usado)
  - `freeShipping`, `localPickup`
  - Toggles para IA: gerar títulos, gerar descrições, auto-categorizar
- Etapa 3: Processamento (cria rascunhos no banco, depois roda IA se ativada)

**2. Fluxo de Execução**
- Ao clicar "Criar Anúncios":
  1. Cria `meli_listings` com status `draft` para cada produto selecionado (preço/estoque pré-preenchidos do produto, configurações padrão aplicadas)
  2. Se IA ativada, chama `meli-bulk-operations` com `listingIds` dos rascunhos criados para gerar títulos, descrições e categorias
  3. Progresso visual em tempo real
  4. Ao finalizar, fecha o dialog e a tabela mostra os novos rascunhos

**3. Edição Individual Mantida**
- O wizard de edição (modo `edit`) continua funcionando como está para ajustar um anúncio específico na tabela
- Cada rascunho pode ser editado individualmente depois na tabela (botão ✏️)

**4. Atualizar `MeliListingsTab.tsx`**
- Trocar referência de `MeliListingWizard` (create mode) para `MeliListingCreator`
- Manter `MeliListingWizard` apenas para modo `edit`
- Remover botão "Enviar Todos" da barra de ações em massa (agora o fluxo de criação já suporta multi-seleção)

**5. Atualizar `useMeliListings.ts`**
- Adicionar mutation `createBulkListings` que insere múltiplos rascunhos de uma vez

### Arquivos Afetados
| Arquivo | Ação |
|---------|------|
| `src/components/marketplaces/MeliListingCreator.tsx` | **Criar** - Novo componente multi-produto |
| `src/components/marketplaces/MeliListingWizard.tsx` | **Manter** - Usado apenas para edição individual |
| `src/components/marketplaces/MeliListingsTab.tsx` | **Editar** - Usar `MeliListingCreator` no botão "Novo Anúncio" |
| `src/hooks/useMeliListings.ts` | **Editar** - Adicionar `createBulkListings` |
| `docs/regras/mercado-livre.md` | **Atualizar** - Documentar novo fluxo |

