

## Plano: Documentação Completa da UI do Sistema

### Objetivo
Criar um documento formal de referência da UI (Layer 3 — Transversais) com o mapa completo de rotas, telas, navegação e regras de visibilidade, segmentado por tipo de usuário. Depois, atualizar o Knowledge (Layer 1) para tornar obrigatória a atualização desse doc em toda entrega que impacte a UI.

---

### Parte 1 — Criar o documento `docs/especificacoes/transversais/mapa-ui.md`

**Estrutura do documento:**

1. **Cabeçalho padrão** (Camada, Status, Última atualização)

2. **Mapa de Navegação (Sidebar)** — Tabela completa com todas as 14 seções e seus itens:

| Grupo | Item | Rota | Visibilidade |
|-------|------|------|-------------|
| Principal | Central de Comando | /command-center | Todos |
| Principal | ChatGPT | /chatgpt | Bloqueável (assistant) |
| E-commerce | Pedidos | /orders | RBAC |
| ... | ... | ... | ... |
| Plataforma | Health Monitor | /platform/health-monitor | Platform Admin only |

3. **Segmentação por Perfil de Acesso** — 3 blocos separados:

   **a) Tenant Normal (cliente)**
   - Sidebar: `fullNavigation` (13 grupos)
   - Itens com `blockedFeature` mostram badge "Upgrade" se plano não inclui
   - Itens com `ownerOnly` visíveis apenas para owner do tenant
   - RBAC controla visibilidade por role (manager, editor, attendant, assistant, viewer)
   - Sem indicadores de status (✅/🟧)
   - Sem acesso a rotas `/platform/*`

   **b) Tenant Especial (Respeite o Homem, Amazgan)**
   - Mesma sidebar do tenant normal
   - `isUnlimited = true` → sem badges "Upgrade", sem bloqueio de features
   - `showStatusIndicators = true` → mostra ✅/🟧 nos itens
   - Visibilidade técnica de IA (nomes de modelos, provedores) via `useIsSpecialTenant`
   - Sem acesso a rotas `/platform/*`

   **c) Platform Admin (Comando Central)**
   - Toggle de modo: Plataforma vs Minha Loja (`AdminModeContext`)
   - **Modo Plataforma**: sidebar `platformAdminNavigation` (9 itens exclusivos)
   - **Modo Loja**: sidebar `fullNavigation` completa (sem bloqueios)
   - Acesso total a todas as rotas
   - Indicadores de status visíveis (exceto em demo mode)

4. **Rotas Protegidas e Guards** — Inventário de todos os mecanismos:
   - `PermissionGuard` (RBAC por rota)
   - `GatedRoute` (bloqueio por plano/módulo)
   - `FeatureGatedRoute` (bloqueio por feature específica)
   - `PlatformAdminGate` (componente, não rota)
   - Rotas sempre acessíveis: `/`, `/command-center`, `/account/*`, `/getting-started`, `/dev/*`

5. **Rotas Completas do Sistema** — Lista extraída do `App.tsx`:
   - Rotas públicas (auth, storefront)
   - Rotas admin protegidas (~70 rotas)
   - Rotas platform (~9 rotas)
   - Redirects e rotas legadas

6. **Regras de Posicionamento de UI** — Decisões já tomadas:
   - Hub de Integrações (`/integrations`) = apenas conexões, nunca painéis operacionais
   - Sidebar: Sistema vs Utilitários (configurações estruturais vs ferramentas)
   - Informações técnicas de IA ocultas para tenants comuns

7. **Componentes de Layout** — Referência:
   - `AppShell` (sidebar + header + outlet)
   - `AppSidebar` (navegação principal)
   - `AppHeader` (header com tenant switcher, admin mode toggle)
   - `TenantSwitcher` (troca de tenant)
   - `AdminModeToggle` (platform/store switch)

---

### Parte 2 — Atualizar o Knowledge (Layer 1)

Adicionar ao checklist obrigatório de governança:

- Nova linha no checklist: `UI impactada? Doc de UI atualizado (ou lacuna declarada)`
- Nova regra no bloco "GOVERNANÇA DOCUMENTAL": toda entrega que adicione, remova ou altere tela, rota, item de sidebar ou regra de visibilidade deve atualizar `docs/especificacoes/transversais/mapa-ui.md`
- No bloco "📝 DOCUMENTAÇÃO NECESSÁRIA", incluir verificação de UI como item obrigatório

---

### Parte 3 — Atualizar referências no Layer 4

Adicionar ao `docs/MANUAL-DO-SISTEMA.md` (Seção 15 — Índice de documentação):
- Referência ao novo doc `mapa-ui.md` como fonte de verdade para navegação e visibilidade de telas

---

### Resumo da execução

| Passo | Ação | Arquivo |
|-------|------|---------|
| 1 | Criar doc completo da UI | `docs/especificacoes/transversais/mapa-ui.md` |
| 2 | Atualizar Knowledge com regra de UI obrigatória | Knowledge (Layer 1) |
| 3 | Adicionar referência no Manual | `docs/MANUAL-DO-SISTEMA.md` |

