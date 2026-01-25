# Platform Admin — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-25

---

## Visão Geral

Funcionalidades exclusivas para administradores da plataforma (`platform_admins`), que gerenciam recursos globais compartilhados por todos os tenants.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/platform/PlatformAnnouncements.tsx` | Gerenciamento de avisos globais |
| `src/pages/platform/PlatformTutorials.tsx` | Gerenciamento de tutoriais por módulo |
| `src/components/layout/PlatformAlerts.tsx` | Exibição de avisos no header |
| `src/components/layout/ModuleTutorialLink.tsx` | Link de tutorial dinâmico no header |
| `src/components/support-center/TutorialsList.tsx` | Galeria de tutoriais na Central de Suporte |
| `src/pages/SupportCenter.tsx` | Central de Suporte com aba de Tutoriais |
| `src/hooks/usePlatformAnnouncements.ts` | Fetch de avisos ativos |
| `src/hooks/useModuleTutorials.ts` | Mapeamento de rotas para tutoriais |

---

## Tabelas do Banco

### platform_announcements

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `title` | TEXT | Título do aviso |
| `message` | TEXT | Conteúdo do aviso |
| `variant` | TEXT | Tipo: `info`, `warning`, `error`, `success` |
| `link_url` | TEXT | URL opcional para redirecionamento |
| `link_text` | TEXT | Texto do link (ex: "Saiba mais") |
| `is_active` | BOOLEAN | Se está ativo |
| `starts_at` | TIMESTAMPTZ | Início da exibição (opcional) |
| `ends_at` | TIMESTAMPTZ | Fim da exibição (opcional) |
| `created_by` | UUID | FK profiles |

### module_tutorials

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `module_key` | TEXT | Chave única do módulo (ex: `orders`, `products`) |
| `video_url` | TEXT | URL do vídeo (YouTube, Vimeo, Loom) |
| `thumbnail_url` | TEXT | Thumbnail opcional |
| `title` | TEXT | Título do tutorial |
| `description` | TEXT | Descrição opcional |
| `is_active` | BOOLEAN | Se está ativo |

---

## Sistema de Avisos da Plataforma

### Variantes e Cores

| Variant | Cor | Uso |
|---------|-----|-----|
| `info` | Azul | Informações gerais |
| `warning` | Laranja | Alertas de atenção |
| `error` | Vermelho | Problemas críticos |
| `success` | Verde | Novidades e melhorias |

### Exibição no Header

- Avisos aparecem no lado **esquerdo** do header admin
- Máximo de **3 avisos** visíveis simultaneamente
- Cada aviso é um botão com ícone correspondente ao variant
- Clique abre link externo (se configurado)

### Agendamento

- `starts_at`: Aviso só aparece após esta data
- `ends_at`: Aviso desaparece após esta data
- Ambos opcionais: se vazios, aviso aparece sempre (enquanto `is_active = true`)

---

## Sistema de Tutoriais por Módulo

### Mapeamento de Rotas

```typescript
const ROUTE_TO_MODULE: Record<string, string> = {
  '/': 'dashboard',
  '/command-center': 'dashboard',
  '/orders': 'orders',
  '/products': 'products',
  '/customers': 'customers',
  '/categories': 'categories',
  '/discounts': 'discounts',
  '/shipping': 'shipping',
  '/checkout': 'checkout',
  '/storefront': 'storefront',
  '/builder': 'builder',
  '/blog': 'blog',
  '/integrations': 'integrations',
  '/affiliates': 'affiliates',
  '/reviews': 'reviews',
  '/abandoned-checkouts': 'abandoned-checkouts',
  // ... outros módulos
};
```

### Exibição no Header

- Link aparece no lado **direito** do header admin
- Texto: "Veja tutorial deste módulo"
- Só aparece se existir tutorial ativo para a rota atual
- Clique abre popup com vídeo incorporado

### Players Suportados

| Plataforma | Formato de URL |
|------------|----------------|
| YouTube | `youtube.com/watch?v=...` ou `youtu.be/...` |
| Vimeo | `vimeo.com/...` |
| Loom | `loom.com/share/...` |

---

## Central de Suporte — Aba Tutoriais

### Componente TutorialsList

```tsx
// Exibe galeria de todos os tutoriais ativos
<TutorialsList />

// Fetch de module_tutorials onde is_active = true
// Grid responsivo de cards clicáveis
// Click abre Dialog com iframe do vídeo
```

### Estrutura de Navegação

```
SupportCenter
├── Tickets (default)
│   ├── Todos
│   ├── Abertos
│   └── Fechados
└── Tutoriais
    └── TutorialsList (grid de vídeos)
```

### Labels de Módulos

```typescript
const moduleLabels: Record<string, string> = {
  'command-center': 'Central de Execuções',
  'orders': 'Pedidos',
  'products': 'Produtos',
  'customers': 'Clientes',
  'categories': 'Categorias',
  'discounts': 'Descontos',
  'shipping': 'Logística',
  'checkout': 'Checkout',
  'storefront': 'Loja Virtual',
  'builder': 'Editor Visual',
  'blog': 'Blog',
  'integrations': 'Integrações',
  'affiliates': 'Afiliados',
  'reviews': 'Avaliações',
  'abandoned-checkouts': 'Checkouts Abandonados',
  // ... outros módulos
};
```

## Rotas Admin

| Rota | Página | Permissão |
|------|--------|-----------|
| `/platform/announcements` | Avisos da Plataforma | platform_admin |
| `/platform/tutorials` | Tutoriais por Módulo | platform_admin |

---

## RLS Policies

### platform_announcements

```sql
-- Platform admins podem gerenciar avisos
CREATE POLICY "Platform admins can manage announcements"
ON platform_announcements FOR ALL
USING (is_platform_admin());

-- Todos podem ler avisos ativos
CREATE POLICY "Anyone can read active announcements"
ON platform_announcements FOR SELECT
USING (is_active = true);
```

### module_tutorials

```sql
-- Platform admins podem gerenciar tutoriais
CREATE POLICY "Platform admins can manage tutorials"
ON module_tutorials FOR ALL
USING (is_platform_admin());

-- Todos podem ler tutoriais ativos
CREATE POLICY "Anyone can read active tutorials"
ON module_tutorials FOR SELECT
USING (is_active = true);
```

---

## Componentes UI

### PlatformAlerts

```tsx
// Exibe avisos coloridos no header
<PlatformAlerts />

// Renderiza até 3 botões ghost com:
// - Ícone baseado no variant
// - Background colorido transparente
// - Click abre link_url em nova aba
```

### ModuleTutorialLink

```tsx
// Link de tutorial dinâmico
<ModuleTutorialLink />

// Se existir tutorial para a rota atual:
// - Exibe botão "Veja tutorial deste módulo"
// - Click abre Dialog com iframe do vídeo
// - Suporta autoplay
```

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Avisos sem data de expiração para promoções | Sempre definir `ends_at` para avisos temporários |
| Tutoriais com URLs inválidas | Validar formato da URL antes de salvar |
| Muitos avisos simultâneos | Limitar a 3-5 avisos ativos por vez |

---

## Checklist

- [x] Avisos aparecem no header
- [x] Cores correspondem ao variant
- [x] Links abrem em nova aba
- [x] Tutoriais aparecem por módulo no header
- [x] Popup de vídeo funciona
- [x] Agendamento de avisos funciona
- [x] RLS protege operações de escrita
- [x] Aba Tutoriais na Central de Suporte
- [x] Grid responsivo de tutoriais
- [x] Labels traduzidos por módulo

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar este documento por conta própria |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]` |
