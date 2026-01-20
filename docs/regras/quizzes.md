# Quizzes — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-20

---

## Visão Geral

Sistema de quizzes interativos para captura de leads com integração completa ao Email Marketing. Suporta diversos tipos de perguntas, segmentação via tags e sincronização automática com a base de clientes.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Quizzes.tsx` | Página de listagem de quizzes |
| `src/components/quizzes/QuizList.tsx` | Lista de quizzes com ações |
| `src/components/quizzes/QuizEditor.tsx` | Editor de quiz individual |
| `src/components/quizzes/QuizDialog.tsx` | Modal criar/editar quiz |
| `src/components/quizzes/QuestionDialog.tsx` | Modal criar/editar pergunta |
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

Perguntas do quiz.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `quiz_id` | UUID | FK quizzes |
| `order_index` | INT | Ordem de exibição |
| `type` | ENUM | Tipo da pergunta (ver abaixo) |
| `question` | TEXT | Texto da pergunta |
| `options` | JSONB | Opções para escolha |
| `is_required` | BOOLEAN | Pergunta obrigatória |
| `mapping` | JSONB | Mapeamento de tags por resposta |

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

## Tipos de Pergunta

| Tipo | Descrição | UI |
|------|-----------|-----|
| `single_choice` | Escolha única | RadioGroup |
| `multiple_choice` | Múltipla escolha | Checkboxes |
| `text` | Texto livre | Input text |
| `email` | Captura de email | Input email |
| `phone` | Captura de telefone | Input tel |
| `name` | Captura de nome | Input text |

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
6. Adiciona perguntas via QuestionDialog
   ↓
7. Clica "Publicar" → status = "published"
```

### Submissão Pública

```
1. Visitante acessa /quiz/:slug (via StorefrontQuiz ou QuizEmbedBlock)
   ↓
2. Vê intro_text, clica "Começar"
   ↓
3. Responde perguntas uma a uma
   ↓
4. Na última pergunta, clica "Finalizar"
   ↓
5. Frontend chama edge function quiz-submit:
   {
     tenant_id, quiz_slug, answers, metadata
   }
   ↓
6. Edge function:
   a. Busca quiz publicado
   b. Extrai email/name/phone das respostas
   c. Se tem email válido:
      - Upsert em email_marketing_subscribers
      - Aplica tags_to_add do quiz
      - Adiciona tags do mapping das perguntas
      - Se list_id: adiciona à lista
   d. Salva quiz_responses
   e. Registra email_events (quiz_completed)
   f. Dispara automações com trigger "quiz_completed"
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

Isso garante:
- Email normalizado (trim + lowercase)
- Upsert em customers e email_marketing_subscribers
- Tag aplicada automaticamente
- Sem duplicatas na base

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

### Comportamento

- No modo edição: exibe placeholder se nenhum quiz selecionado
- No público: carrega e renderiza quiz completo
- Submissão via mesma edge function quiz-submit

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

### Response (erro)

```json
{
  "success": false,
  "error": "Quiz not found or not published"
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
| `addQuestion.mutate({quizId, question})` | Adiciona pergunta |
| `updateQuestion.mutate({id, ...})` | Atualiza pergunta |
| `deleteQuestion.mutate(id)` | Remove pergunta |
| `reorderQuestions.mutate([...])` | Reordena perguntas |

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Quiz sem tag_id | Sempre vincular a uma tag para captura |
| Submeter quiz draft | Verificar status === 'published' |
| Email sem normalização | Usar trim().toLowerCase() |
| Perguntas sem order_index | Manter índices consistentes |

---

## Checklist

- [x] CRUD de quizzes funcional
- [x] Tipos de pergunta implementados
- [x] Reordenação de perguntas
- [x] Publicar/despublicar
- [x] Rota pública /quiz/:slug
- [x] Edge function quiz-submit
- [x] Integração com Email Marketing (tags)
- [x] QuizEmbedBlock no builder
- [x] Automações por trigger quiz_completed
