

## Plano: Mesclar Landing Pages dentro de "Páginas da Loja"

### Resumo

Unificar os módulos "Páginas da Loja" e "Landing Pages" em uma única página `/pages` com duas abas (Páginas | Landing Pages) e dois botões de criação separados com dropdown de opções.

### Mudanças

**1. `src/pages/Pages.tsx` — Refatoração completa**

- Adicionar **Tabs** (Páginas | Landing Pages) usando o componente `Tabs` existente
- **Aba "Páginas"**: Mantém a tabela atual de páginas institucionais (query `store_pages` type `institutional/custom`)
- **Aba "Landing Pages"**: Nova tabela listando LPs de ambas fontes (`ai_landing_pages` + `store_pages` type `landing_page`), reutilizando a lógica de merge que já existe em `LandingPages.tsx`
- **Header com 2 botões**:
  - "Criar Página" → Abre o dialog atual de criação de página institucional
  - "Criar Landing Page" → Dropdown/dialog com 3 opções: "No Builder", "Com IA", "Importar com IA"
- Importar os componentes necessários: `CreateLandingPageDialog`, `LandingPagePreviewDialog`, `ImportPageWithAIDialog`
- Mover toda a lógica de listagem/delete/preview de LPs para cá

**2. `src/components/layout/AppSidebar.tsx`**

- Remover item "Landing Pages" (`/landing-pages`) do menu
- Manter apenas "Páginas da Loja" (`/pages`)

**3. `src/App.tsx`**

- Manter a rota `/landing-pages/:id` para o editor HTML de LPs IA (continua necessária)
- Remover a rota `/landing-pages` (listagem) — redirecioná-la para `/pages`

**4. `docs/regras/landing-pages.md` e `docs/regras/paginas-institucionais.md`**

- Atualizar para refletir que a listagem agora é unificada em `/pages`
- Documentar a nova estrutura de abas e botões

### Detalhes Técnicos

```text
┌─────────────────────────────────────────────────────┐
│  Páginas da Loja                                    │
│  "Gerencie páginas e landing pages da sua loja"     │
│                                                     │
│  [Criar Página]  [Criar Landing Page ▾]             │
│                   ├─ No Builder                     │
│                   ├─ Com IA                         │
│                   └─ Importar com IA                │
│                                                     │
│  ┌──────────┐ ┌───────────────┐                     │
│  │ Páginas  │ │ Landing Pages │                     │
│  └──────────┘ └───────────────┘                     │
│                                                     │
│  (conteúdo da aba ativa)                            │
└─────────────────────────────────────────────────────┘
```

- O hook `useStorePages` continua filtrando `type IN ('institutional','custom')` — sem mudança
- As queries de `ai_landing_pages` e `store_pages` type `landing_page` serão adicionadas diretamente em `Pages.tsx`
- Delete de LP Builder também deleta o `page_template` associado (já existe essa lógica)
- O botão "Criar Landing Page" pode usar `DropdownMenu` para as 3 opções

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Pages.tsx` | Refatorar com abas + lógica de LPs |
| `src/components/layout/AppSidebar.tsx` | Remover item Landing Pages |
| `src/App.tsx` | Redirect `/landing-pages` → `/pages` |
| `src/pages/LandingPages.tsx` | Pode ser mantido mas não mais acessado diretamente |
| `docs/regras/landing-pages.md` | Atualizar rotas de listagem |
| `docs/regras/paginas-institucionais.md` | Atualizar para refletir módulo unificado |

