# Quizzes — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-02-26  
> **Integração Tags:** Sistema unificado `customer_tags`

---

## Visão Geral

Sistema de quizzes interativos para captura de leads com integração completa ao Email Marketing. Suporta **etapas mistas** (conteúdo rico + perguntas), diversos tipos de perguntas, mídia embarcada (imagens, vídeos), segmentação via tags e sincronização automática com a base de clientes.

**IMPORTANTE:** O sistema de tags do Quiz utiliza o **sistema unificado de tags** (`customer_tags`) do módulo de Clientes. NÃO existe sistema de tags separado para quizzes.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Quizzes.tsx` | Página de listagem de quizzes |
| `src/components/quizzes/QuizList.tsx` | Lista de quizzes com ações |
| `src/components/quizzes/QuizEditor.tsx` | Editor de quiz com etapas mistas |
| `src/components/quizzes/QuizDialog.tsx` | Modal criar/editar quiz |
| `src/components/quizzes/QuestionDialog.tsx` | Modal criar/editar etapa (pergunta ou conteúdo) |
| `src/hooks/useQuizzes.ts` | Hook CRUD centralizado |
| `src/pages/storefront/StorefrontQuiz.tsx` | Renderização pública do quiz |
| `src/components/builder/blocks/interactive/QuizEmbedBlock.tsx` | Bloco para embed no builder |
| `supabase/functions/quiz-submit/index.ts` | Edge function de submissão |

---

## Tabelas do Banco

### quizzes

Configuração principal do quiz.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome do quiz |
| `slug` | TEXT | URL amigável (único por tenant) |
| `intro_text` | TEXT | Texto de introdução |
| `outro_text` | TEXT | Texto de conclusão |
| `list_id` | UUID | FK email_marketing_lists (opcional) |
| `tag_id` | UUID | FK customer_tags (obrigatório para captura) |
| `tags_to_add` | TEXT[] | Tags adicionais a aplicar |
| `settings` | JSONB | Configurações extras |
| `status` | ENUM | `draft`, `published` |

### quiz_questions

Etapas do quiz (perguntas ou conteúdo).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `quiz_id` | UUID | FK quizzes |
| `order_index` | INT | Ordem de exibição |
| `step_type` | TEXT | `question` ou `content` |
| `type` | ENUM | Tipo da pergunta (ver abaixo) |
| `question` | TEXT | Texto da pergunta ou título do conteúdo |
| `description` | TEXT | Texto rico/markdown de apoio |
| `media` | JSONB | Mídia embarcada (ver estrutura abaixo) |
| `options` | JSONB | Opções para escolha (com suporte a imagem) |
| `is_required` | BOOLEAN | Pergunta obrigatória |
| `mapping` | JSONB | Mapeamento de tags por resposta |

#### Estrutura do campo `media`

```json
{
  "type": "image" | "video",
  "url": "https://...",
  "alt": "Descrição da imagem"
}
```

- Para vídeos YouTube/Vimeo: `type: "video"`, `url` contém a URL do embed
- Para imagens: `type: "image"`, `url` contém a URL da imagem

#### Estrutura do campo `options` (com imagem)

```json
[
  {
    "value": "opcao-1",
    "label": "Opção 1",
    "image_url": "https://...",
    "tags": ["tag-id-1"]
  }
]
```

### quiz_responses

Respostas submetidas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `quiz_id` | UUID | FK quizzes |
| `subscriber_id` | UUID | FK email_marketing_subscribers |
| `answers` | JSONB | Respostas por question_id |
| `metadata` | JSONB | Dados extras (user_agent, referrer) |
| `created_at` | TIMESTAMPTZ | Data da submissão |

---

## Tipos de Etapa (`step_type`)

| Tipo | Descrição | Comportamento |
|------|-----------|---------------|
| `question` | Etapa com pergunta e resposta | Exige input do visitante |
| `content` | Etapa informativa/mídia | Exibe conteúdo, botão "Continuar" |

## Tipos de Pergunta

| Tipo | Descrição | UI |
|------|-----------|-----|
| `single_choice` | Escolha única | RadioGroup ou Grid de Cards (se tem imagem) |
| `multiple_choice` | Múltipla escolha | Checkboxes ou Grid de Cards (se tem imagem) |
| `text` | Texto livre | Input text |
| `email` | Captura de email | Input email |
| `phone` | Captura de telefone | Input tel |
| `name` | Captura de nome | Input text |

### Grid de Cards com Imagem

Quando `options` contém `image_url`, a UI renderiza um **grid 2 colunas** de cards visuais:
- Imagem no topo do card (aspect-ratio: video)
- Label abaixo da imagem
- Borda destacada ao selecionar
- Aplica-se a `single_choice` e `multiple_choice`

---

## Fluxos

### Criação de Quiz (Admin)

```
1. Admin acessa /quizzes
   ↓
2. Clica "Novo Quiz"
   ↓
3. Preenche: nome, slug, intro_text, outro_text, list_id, tag_id
   ↓
4. Quiz criado como "draft"
   ↓
5. Navega para /quizzes/:quizId
   ↓
6. Adiciona etapas via QuestionDialog (pergunta ou conteúdo)
   ↓
7. Clica "Publicar" → status = "published"
```

### Criação de Etapa (QuestionDialog)

```
1. Admin clica "Adicionar Etapa"
   ↓
2. Seleciona step_type: "Pergunta" ou "Conteúdo"
   ↓
3. Se "Pergunta":
   a. Escolhe tipo (single_choice, text, email, etc.)
   b. Preenche texto da pergunta
   c. (Opcional) Adiciona descrição markdown
   d. (Opcional) Adiciona mídia (imagem ou vídeo)
   e. Se choice: configura opções (com ou sem imagem)
   ↓
4. Se "Conteúdo":
   a. Preenche título
   b. (Opcional) Adiciona descrição markdown
   c. (Opcional) Adiciona mídia (imagem ou vídeo)
   ↓
5. Salva etapa
```

### Submissão Pública

```
1. Visitante acessa /quiz/:slug (via StorefrontQuiz ou QuizEmbedBlock)
   ↓
2. Vê intro_text, clica "Começar"
   ↓
3. Navega pelas etapas:
   - Etapa "content": vê mídia/texto, clica "Continuar"
   - Etapa "question": responde pergunta
   ↓
4. Na última etapa, clica "Finalizar"
   ↓
5. Frontend chama edge function quiz-submit
   ↓
6. Edge function processa (ver detalhes abaixo)
   ↓
7. Retorna outro_text para exibição
```

### Integração com sync_subscriber_to_customer_with_tag

O quiz usa a mesma rotina unificada de captura:

```sql
SELECT sync_subscriber_to_customer_with_tag(
  p_tenant_id,
  p_email,
  p_name,
  p_phone,
  p_tag_id,      -- tag_id do quiz
  p_source       -- 'quiz:{slug}'
);
```

---

## Mídia Suportada

### Imagens

- Upload via URL ou storage
- Exibidas com `object-fit: cover`, `rounded-lg`
- Alt text para acessibilidade

### Vídeos (YouTube / Vimeo)

- Suporte a URLs do YouTube e Vimeo
- Extração automática do ID do vídeo
- Renderização via `<iframe>` responsivo (aspect-ratio 16:9)
- Padrões de URL aceitos:
  - `youtube.com/watch?v=ID`
  - `youtu.be/ID`
  - `vimeo.com/ID`

### Texto Rico (Descrição)

- Campo `description` suporta Markdown
- Renderizado via `react-markdown` no storefront
- Suporta: negrito, itálico, listas, links, headings

---

## Integração Unificada de Tags

O QuizDialog utiliza o hook `useCustomerTags` do módulo de Clientes para gerenciar tags.

### Hook Obrigatório

```typescript
import { useCustomerTags } from "@/hooks/useCustomers";

const { tags, isLoading, createTag } = useCustomerTags();
```

### Comportamento no QuizDialog

1. **Exibe tags existentes** da tabela `customer_tags` via Select
2. **Mostra badges** das primeiras 5 tags para seleção rápida
3. **Permite criar nova tag inline** com nome e cor
4. **Auto-seleciona** a tag recém-criada no formulário

### Paleta de Cores Padrão

```typescript
const colorOptions = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"
];
```

### Anti-Patterns (Tags)

| Proibido | Correto |
|----------|---------|
| Criar sistema de tags separado | Usar `useCustomerTags` |
| Query direta em `customer_tags` | Usar hook centralizado |
| Tag sem cor | Sempre atribuir cor da paleta |

---

## Rotas

### Admin

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/quizzes` | Quizzes.tsx | Lista de quizzes |
| `/quizzes/:quizId` | QuizEditor | Editor de quiz |

### Público (Storefront)

| Rota | Componente | Descrição |
|------|------------|-----------|
| `/:tenantSlug/quiz/:quizSlug` | StorefrontQuiz | Quiz público |

---

## Builder Block: QuizEmbed

Bloco para incorporar quiz em páginas do builder.

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `quizId` | string | ID do quiz a exibir |
| `quizSlug` | string | Alternativa: slug do quiz |
| `backgroundColor` | string | Cor de fundo |
| `textColor` | string | Cor do texto |
| `primaryColor` | string | Cor primária (botões) |
| `borderRadius` | number | Arredondamento |

---

## Edge Function: quiz-submit

### Request

```json
{
  "tenant_id": "uuid",
  "quiz_slug": "meu-quiz",
  "answers": {
    "question-id-1": "resposta",
    "question-id-2": ["opção1", "opção2"]
  },
  "metadata": {
    "user_agent": "...",
    "referrer": "..."
  }
}
```

### Response (sucesso)

```json
{
  "success": true,
  "message": "Obrigado por completar o quiz!",
  "response_id": "uuid"
}
```

---

## Interfaces TypeScript

### QuizQuestionMedia

```typescript
interface QuizQuestionMedia {
  type: 'image' | 'video';
  url: string;
  alt?: string;
}
```

### QuizQuestionOption

```typescript
interface QuizQuestionOption {
  value: string;
  label: string;
  tags?: string[];
  image_url?: string;
}
```

### QuizQuestion

```typescript
interface QuizQuestion {
  id: string;
  quiz_id: string;
  order_index: number;
  step_type: 'question' | 'content';
  type: 'single_choice' | 'multiple_choice' | 'text' | 'email' | 'phone' | 'name';
  question: string;
  description?: string;
  media?: QuizQuestionMedia;
  options?: QuizQuestionOption[];
  is_required: boolean;
  mapping?: { field?: string; tags?: string[] };
}
```

---

## Hook: useQuizzes

### Métodos

| Método | Descrição |
|--------|-----------|
| `quizzes` | Lista de quizzes do tenant |
| `isLoading` | Estado de carregamento |
| `getQuiz(id)` | Busca quiz com perguntas |
| `getQuizResponses(id)` | Busca respostas do quiz |
| `createQuiz.mutate(data)` | Cria novo quiz |
| `updateQuiz.mutate({id, ...})` | Atualiza quiz |
| `deleteQuiz.mutate(id)` | Exclui quiz |
| `togglePublish.mutate({quizId, publish})` | Publicar/despublicar |
| `addQuestion.mutate({quizId, question})` | Adiciona etapa |
| `updateQuestion.mutate({id, ...})` | Atualiza etapa |
| `deleteQuestion.mutate(id)` | Remove etapa |
| `reorderQuestions.mutate([...])` | Reordena etapas |

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Quiz sem tag_id | Sempre vincular a uma tag para captura |
| Submeter quiz draft | Verificar status === 'published' |
| Email sem normalização | Usar trim().toLowerCase() |
| Perguntas sem order_index | Manter índices consistentes |
| Etapa content com is_required | Content steps não exigem resposta |
| Opções com imagem sem grid | Usar Grid de Cards quando há image_url |
| Vídeo sem extração de ID | Usar regex para extrair embed URL |

---

## Checklist

- [x] CRUD de quizzes funcional
- [x] Tipos de pergunta implementados
- [x] Reordenação de etapas
- [x] Publicar/despublicar
- [x] Rota pública /quiz/:slug
- [x] Edge function quiz-submit
- [x] Integração com Email Marketing (tags)
- [x] QuizEmbedBlock no builder
- [x] Automações por trigger quiz_completed
- [x] Etapas mistas (conteúdo + pergunta)
- [x] Mídia embarcada (imagem + vídeo YouTube/Vimeo)
- [x] Descrição rica com Markdown
- [x] Opções com imagem (Grid de Cards)
- [x] step_type no banco (question/content)
