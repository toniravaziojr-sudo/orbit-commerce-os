

# Plano: Fluxo de Criação de Campanhas de Email Marketing com Editor Visual

## Situacao Atual

O modulo de email marketing existe mas e bastante basico:
- **CampaignDialog**: modal simples com 4 campos (nome, tipo, lista, template)
- **TemplateDialog**: textarea de HTML cru, sem preview, sem editor visual
- **Nao ha**: editor de email visual, steps wizard, preview em tempo real, drag-and-drop de blocos
- Backend ja funciona: `email-campaign-broadcast` edge function, `email_send_queue`, `email-dispatcher`

## Proposta: Campaign Builder em 3 Steps com Email Editor Visual

Substituir o modal simples por uma pagina dedicada de criacao de campanha com wizard de steps e editor visual de email.

### Arquitetura

```text
/email-marketing/campaign/new
  ┌─────────────────────────────────────────────────┐
  │  Step Bar: [1. Config] → [2. Conteudo] → [3. Enviar]  │
  └─────────────────────────────────────────────────┘

  Step 1 - Configuracao
  ├── Nome da campanha
  ├── Tipo (broadcast / automacao)
  ├── Lista de destino (select)
  └── Remetente (from email_provider_configs)

  Step 2 - Conteudo (Editor Visual)
  ├── Assunto do email + preview text
  ├── Toolbar lateral com blocos arrastaveis:
  │   ├── Texto (heading, paragrafo)
  │   ├── Imagem
  │   ├── Botao (CTA)
  │   ├── Divisor
  │   ├── Espacador
  │   ├── Colunas (2col, 3col)
  │   └── Produto (puxa do catalogo)
  ├── Area central: blocos empilhados (drag to reorder)
  ├── Painel direito: propriedades do bloco selecionado
  └── Preview mobile/desktop toggle

  Step 3 - Revisar & Enviar
  ├── Resumo (lista, qtd subscribers, assunto)
  ├── Preview final do email (iframe)
  ├── Opcoes: Enviar agora / Agendar
  └── Botao "Enviar Campanha"
```

### Arquivos a Criar (~12 arquivos)

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/EmailMarketingCampaignBuilder.tsx` | Pagina do wizard (rota `/email-marketing/campaign/new`) |
| `src/components/email-marketing/campaign-builder/CampaignStepBar.tsx` | Barra de progresso dos steps |
| `src/components/email-marketing/campaign-builder/StepConfig.tsx` | Step 1: nome, tipo, lista |
| `src/components/email-marketing/campaign-builder/StepContent.tsx` | Step 2: editor visual |
| `src/components/email-marketing/campaign-builder/StepReview.tsx` | Step 3: revisao e envio |
| `src/components/email-marketing/campaign-builder/EmailBlocksSidebar.tsx` | Sidebar com blocos arrastaveis |
| `src/components/email-marketing/campaign-builder/EmailCanvas.tsx` | Area central com blocos (sortable) |
| `src/components/email-marketing/campaign-builder/BlockPropertyEditor.tsx` | Painel de propriedades do bloco |
| `src/components/email-marketing/campaign-builder/EmailPreview.tsx` | Preview do email (iframe) |
| `src/components/email-marketing/campaign-builder/blocks/` | Componentes de cada bloco (TextBlock, ImageBlock, ButtonBlock, DividerBlock, SpacerBlock, ColumnsBlock, ProductBlock) |
| `src/hooks/useEmailCampaignBuilder.ts` | State machine do builder (blocos, seleção, serialização para HTML) |
| `src/lib/email-builder-utils.ts` | Serializar blocos → HTML inline-style para email |

### Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/EmailMarketing.tsx` | Botao "Nova Campanha" redireciona para `/email-marketing/campaign/new` em vez de abrir dialog |
| `src/App.tsx` | Registrar rota `/email-marketing/campaign/new` |

### Tecnologia de Drag-and-Drop

Usar `@dnd-kit/core` + `@dnd-kit/sortable` que ja estao instalados no projeto. Abordagem:
- Sidebar: blocos com `useDraggable` 
- Canvas: lista de blocos com `useSortable` (reordenar)
- Drop da sidebar no canvas para adicionar novos blocos

### Editor de Blocos (Modelo de dados)

```typescript
interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'product';
  props: Record<string, any>;
  // Exemplos de props por tipo:
  // text: { content: string, tag: 'h1'|'h2'|'p', align, color, fontSize }
  // image: { src: string, alt: string, width: string, link?: string }
  // button: { text: string, url: string, bgColor, textColor, borderRadius }
  // divider: { color, thickness }
  // spacer: { height: number }
  // columns: { columns: EmailBlock[][] }
  // product: { product_id: string, showPrice, showImage, showButton }
}
```

### Conversao Blocos → HTML

A funcao `blocksToHtml()` em `email-builder-utils.ts` converte a arvore de blocos para HTML table-based com inline styles (compativel com email clients). Nao depende de CSS externo.

### Fluxo de Envio

1. Usuario monta o email no builder
2. No Step 3, `blocksToHtml()` gera o HTML final
3. Ao clicar "Enviar", salva template (upsert `email_marketing_templates`) + campanha (upsert `email_marketing_campaigns`)
4. Chama `email-campaign-broadcast` edge function
5. Redireciona para listagem com toast de sucesso

### Sem Mudancas no Banco

Nenhuma migracao necessaria. Os campos `body_html` e `body_text` do template ja comportam o HTML gerado. A campanha ja tem `template_id` e `list_id`.

### Estimativa

Sera implementado em 2-3 rodadas de mensagens devido ao volume de arquivos.

