📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema: lido
- Doc formal do tema: `docs/especificacoes/marketplaces/mercado-livre.md`
- Memória relevante: `ml-cadastro-fonte-unica.md`
- Fluxo afetado: Wizard ML → resolução de características (Edge Function `meli-resolve-attributes`)
- Fonte de verdade: cadastro do produto (`products.regulatory_info.anvisa` + `products.description`)
- Módulos impactados: Marketplaces → Mercado Livre
- UI impactada: **não** (mesmo painel, mesmo comportamento — só passa a mostrar 1 Anvisa e mais ingredientes)
- Validação técnica feita: leitura das linhas 540–820 do motor confirma as duas causas-raiz
- Situação: **Ajuste aplicado — pendente de validação técnica/deploy**

---

# Confirmação do diagnóstico (auditoria executada)

**ANVISA — confirmado:** a heurística no motor casa pelo nome do atributo (`"anvisa"` + `numero|notifica|comunica|registro|documento`). Em categorias como cosmético, isso casa **nos dois atributos** que o ML expõe, recebendo o mesmo número. É exatamente o "duplicado e mau pareado" que você viu.

**Ingredientes — confirmado:** o motor extrai os blocos da descrição por regex e injeta no contexto, mas o cruzamento contra a lista oficial do ML é **instrução de prompt** entregue à IA. Não há passo determinístico em código que garanta o casamento. Resultado: a IA escolhe 1, descarta os outros, e como o dicionário de sinônimos vive só no prompt, ela ignora silenciosamente.

**Pesquisa técnica:** para vocabulário fechado e curto (13 valores), o padrão de produção é casamento por dicionário + sinônimos em código. LLM fica como reforço, nunca como fonte primária. Mais preciso, mais barato, auditável.

---

# Decisões aprovadas por você

1. **ANVISA = um número único do cadastro, vai em um único atributo do ML.** Sem distinção grau 1/2, sem distinção notificado/registrado. O cadastro é a única fonte.
2. **Ingredientes = caminho técnico mais inteligente.** Decisão técnica minha (autonomia que você me deu): **híbrido com dicionário primeiro e IA só como reforço** — é o caminho com maior precisão, menor custo e menor dependência de modelo.

---

# O que muda no motor de características

**Bloco ANVISA (substitui a heurística atual):**
- Detecta na categoria, por id canônico do ML, quais atributos Anvisa existem (notificação e/ou registro).
- Regra de escolha, nessa ordem:
  1. Se um deles estiver marcado obrigatório pela categoria → o número vai nele; o outro fica vazio.
  2. Se ambos opcionais → o número vai no de **Notificação/Comunicação prévia** (cobre cosmético, o mais comum); o de Registro fica vazio.
  3. Se só um dos dois existir na categoria → vai nele.
- Fim da duplicidade. O painel deixa de mostrar o mesmo número em dois campos.

**Bloco Ingredientes/Componentes/Materiais (pipeline determinístico):**
- Mantém a extração de blocos da descrição que já existe (regex de "Ativos/Composição/Ingredientes/etc.").
- Adiciona um passo de **cruzamento por código**: para cada valor oficial da lista do ML (campo `values` do atributo), procura ocorrências no texto extraído **e** na descrição inteira, normalizando (minúsculas, sem acento, tolerância a colado/separado).
- Adiciona um **dicionário de sinônimos versionado em código** (BPantol/B5/D-Pantenol → Pantenol; AloeVera/Babosa → Aloe vera; Cafeína anidra → Cafeína; Vit E → Vitamina E; etc.). Cresce sem mexer em prompt.
- **Quando o atributo é multivalorado**, devolve **todos** os matches encontrados (até o limite que o ML aceita).
- **IA como reforço**, só quando o cruzamento determinístico retornar 0 itens E houver texto disponível — para captar grafia atípica. Cobre o canto longo sem virar fonte primária.
- Aplicação universal: todo atributo de lista fechada com natureza "ingrediente/componente/material/fórmula/compostos" usa esse pipeline antes de chamar IA.

**Anti-regressão:**
- Atributo de lista fechada nunca mais é resolvido só pela IA — sempre passa pelo cruzamento determinístico primeiro.
- Troca de categoria continua zerando cache (regra já existente).
- Memória de ajustes manuais do lojista continua tendo prioridade máxima.
- Características salvas em rascunho agora têm versão de cache. Cache legado não é mais considerado válido só por existir; recalcula uma única vez e persiste com versão atual.
- Atributo ANVISA não escolhido pela categoria não entra no painel nem segue para IA/N/A.

---

# Resultado para o lojista

- ANVISA aparece **uma única vez** no painel, com o número do cadastro.
- "Ingredientes ativos" passa a vir com **todos os itens** identificáveis na descrição (Aloe Vera, Cafeína, Pantenol, Mentol, etc.), respeitando o limite do ML.
- O lojista pode continuar editando manualmente; a memória de ajustes manuais segue prevalecendo na próxima execução do mesmo produto.
- Custo de IA cai: menos atributos passam pela IA, e quando passam é com lista menor.

---

# Detalhe técnico (para registro)

- `supabase/functions/meli-resolve-attributes/index.ts`:
  - Substituir heurística ANVISA (linhas ~570–586) por seleção por id canônico + regra obrigatório/opcional/fallback notificação.
  - Criar função `crossReferenceClosedList(attribute, extractedItems, productText, synonymMap)` que devolve `values[]` casados com a lista oficial.
  - Criar `SUBSTANCE_SYNONYMS` (Record) no escopo do módulo.
  - No laço principal: antes de adicionar o atributo ao batch da IA, se for lista fechada de substância, aplicar o cruzamento; só joga para IA se vier vazio.
  - Manter `isMultiValuedSpec` e a montagem de `valuesArr` que já existe.
- Sem migração de banco. Sem alteração de UI. Sem alteração de contrato com `MeliAttributesPanel.tsx`.
- `MeliAttributesPanel.tsx`:
  - Persistir `resolver_version` em cada atributo salvo.
  - Reaproveitar cache somente quando todos os atributos salvos têm a versão atual.
  - Cache antigo/incompatível força resolver uma vez, depois volta a abrir sem custo.
- `meli-publish-listing`:
  - Remover metadados internos (`source`, `resolver_version`, `not_applicable`) antes de montar o payload externo quando o atributo não passa por normalização de lista.

---

📝 DOCUMENTAÇÃO NECESSÁRIA:
- `docs/especificacoes/marketplaces/mercado-livre.md` — seção "Motor de Atributos": adicionar regra ANVISA única + pipeline determinístico de listas fechadas.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — adicionar bullets: "ANVISA do cadastro vai num único atributo do ML" e "Atributos de lista fechada usam casamento determinístico antes de IA".
- Motivo: regra estrutural nova do motor; precisa virar anti-regressão.
- Documentação atualizada no manual do Mercado Livre e memória operacional do fluxo.

**Status:** implementação aplicada; falta validação técnica e deploy das funções alteradas.