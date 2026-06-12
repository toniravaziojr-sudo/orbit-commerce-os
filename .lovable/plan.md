
# Auditoria — Pipeline da IA do Gestor de Tráfego

> ⚠️ Esta auditoria **não altera código, banco, UI ou fluxos**. É um diagnóstico para você aprovar o que entra em implementação e em qual ordem.

---

## 1. Como está o fluxo hoje

```text
Usuário ativa Modo Piloto
        │
        ▼
[Análise inicial]  → grava "rodada de análise" (diagnóstico + estratégia + limitações)
        │
        ▼
[Plano Estratégico]  → 1 proposta única do tipo "plano", aguardando aprovação
        │
        ▼
[Aprovar plano]  → marca como aprovado e pede pra IA "implementar o plano"
        │
        ▼
[Campanhas detalhadas]  → criadas como propostas IRMÃS do plano (sem vínculo de pai/filho)
        │
        ▼
[Aprovação em 2 etapas por proposta]  → Estratégia → Criativo → Publicar
        │
        ▼
[Feedback do usuário]  → gravado em tabela de feedback, mas a IA NÃO lê isso nas próximas análises
```

---

## 2. Diagnóstico por área

### A) Análise inicial — **OK com ressalvas**
- Roda só para Meta hoje (Google/TikTok ficam de fora).
- Coleta corretamente: orçamento, ROI alvo, ROI mínimo frio/quente, splits de funil, prompt estratégico, produtos, pedidos, campanhas, insights 7d/30d, criativos, públicos, pixel, integrações.
- **Falta:** o identificador da rodada de análise não é gravado nas propostas filhas, então não dá pra dizer "essa campanha veio dessa análise".

### B) Plano Estratégico — **Funciona, mas sem hierarquia**
- Hoje o plano é uma proposta como outra qualquer, só com tipo "plano estratégico".
- "Aprovar plano" **não publica nada** (isso está correto), mas:
  - As campanhas geradas depois **não ficam ligadas ao plano** (nasce tudo solto na fila).
  - Não há versionamento ("plano v1", "plano v2 ajustado").
  - "Ajustar plano" e "Recusar plano" hoje passam pelo mesmo fluxo de aprovação/recusa genérico — não geram uma nova versão do plano nem registram motivo estruturado.

### C) Propostas detalhadas — **Estrutura existe, faltam amarrações**
- O esqueleto de Campanha / Conjunto / Anúncio existe e é validado por "portões de qualidade":
  - Campanha: nome, objetivo, orçamento → obrigatórios.
  - Conjunto: público, idade, gênero, posicionamentos, evento de otimização → obrigatórios.
  - Anúncio: título, texto, CTA, link → obrigatórios.
- **Falta:**
  - Vínculo pai→filho com o plano que originou.
  - UTM não é exigida em nenhum portão.
  - Ajuste individual de proposta existe no backend mas não está claramente exposto na fila.

### D) Feedback e aprendizado — **GAP CRÍTICO**
- Existe tabela de feedback (aprovar / recusar / ajustar / motivos).
- Existe um "tradutor" (writer) que transforma feedback em "memória aprendida do tenant".
- **Problemas:**
  1. O writer só roda manualmente — feedback do usuário **não vira aprendizado automaticamente**.
  2. A memória aprendida é lida pela IA, mas **só registrada em log** — não influencia o prompt da próxima análise (fase observacional).
  3. **Não existe tela** pro usuário ver, editar, desligar ou remover aprendizados desse pipeline. A tela "Memórias da IA" que existe hoje é de outros agentes (atendimento, assistente) — não tem nada a ver com tráfego.
  4. O histórico bruto de feedback nunca é lido pela IA nas análises seguintes.

> Resultado prático: hoje a IA **não aprende com você** no Gestor de Tráfego. Cada análise nasce do zero.

### E) UTMs — **GAP**
- O campo de UTM existe em 3 lugares (config de produção, esquema da proposta, instrução de prompt).
- A IA é só **instruída** a preencher — não é obrigada.
- Nenhum portão de qualidade bloqueia anúncio sem UTM.
- O modelo padrão de UTM cadastrado na configuração de produção **não é lido** pela IA quando ela monta a proposta.

### F) Contexto do Strategist — **Bom, exceto aprendizado**
- Lê quase tudo o que precisa (configs, produtos, campanhas, métricas, capacidades).
- **Não lê:** feedback histórico, memória aprendida (só observa), modelo padrão de UTM.

---

## 3. Lacunas priorizadas

| # | Lacuna | Impacto | Prioridade |
|---|--------|---------|-----------|
| L1 | Aprendizados sem tela editável pelo usuário | IA "esquece" tudo | 🔴 Alta |
| L2 | Feedback não vira aprendizado automaticamente | Decisões do usuário não retornam à IA | 🔴 Alta |
| L3 | Memória aprendida não influencia o prompt | IA não aplica preferências | 🔴 Alta |
| L4 | Plano aprovado não gera propostas filhas vinculadas | Sem rastreabilidade plano→campanha | 🔴 Alta |
| L5 | UTM não é obrigatória nem usa modelo padrão | Atribuição quebrada | 🟡 Média |
| L6 | Sem versionamento do plano (ajustar/recusar) | Histórico perdido | 🟡 Média |
| L7 | Rodada de análise não fica gravada nas propostas | Difícil auditar origem | 🟢 Baixa |

---

## 4. Arquitetura recomendada (sem implementar ainda)

### 4.1 Hierarquia Plano → Propostas
Plano vira o "pai". Toda campanha criada a partir dele guarda a referência ao plano. Aprovar plano gera as propostas filhas em estado "Aguardando ação", uma por campanha, com estrutura completa.

### 4.2 Aprendizados da IA (área nova nas Configurações da IA)
Tela nova com lista de aprendizados por tenant, mostrando:
- Descrição do aprendizado em linguagem simples
- Origem (aprovação / recusa / ajuste / inserido manualmente)
- Data
- Confiança e nº de evidências
- Status (ativo / pausado / arquivado)
- Ações: editar texto, pausar, ativar, remover, criar manualmente

Regras:
- Aprendizado **sugerido** (gerado por feedback) precisa de confirmação do usuário para virar **ativo**.
- Só aprendizados **ativos** entram no prompt da IA.
- Usuário pode criar aprendizado manualmente ("sempre excluir clientes atuais", "nunca usar kit pra público frio").

### 4.3 Loop de feedback automático
Toda decisão do usuário (aprovar / recusar / ajustar com motivo) dispara o tradutor que sugere um aprendizado novo ou reforça um existente — sem influenciar a IA até o usuário confirmar.

### 4.4 UTM obrigatória
- Configuração estratégica ganha campo "modelo de UTM padrão".
- IA é obrigada a aplicar o modelo no link final de todo anúncio.
- Portão de qualidade bloqueia proposta sem UTM.
- UTM mora no nível Anúncio (não Campanha).
- Modelo sugerido: `utm_source=meta&utm_medium=paid_social&utm_campaign={nome_campanha}&utm_content={nome_anuncio}&utm_term={publico_ou_funil}`.

### 4.5 Versionamento do plano
- "Ajustar plano" gera versão nova, mantendo a anterior arquivada.
- "Recusar plano" registra motivo e abre espaço pra IA propor outro.

---

## 5. Sequência de implementação sugerida (a aprovar)

| Etapa | Entrega | Pré-requisito |
|-------|---------|--------------|
| 1 | **Aprendizados da IA** — tela editável + loop automático feedback→aprendizado (sem influenciar IA ainda) | Nenhum |
| 2 | Ativar uso real dos aprendizados ativos no prompt da IA | Etapa 1 validada por você |
| 3 | **Hierarquia Plano→Propostas filhas** (vínculo pai/filho + rastreabilidade da rodada de análise) | Nenhum |
| 4 | **Versionamento do plano** (ajustar gera v2, recusar registra motivo) | Etapa 3 |
| 5 | **UTM obrigatória** (campo na config + portão bloqueando + modelo padrão lido pela IA) | Nenhum |
| 6 | Expansão para Google/TikTok da análise inicial | Etapas 1–5 estabilizadas |

Rollout sugerido: cada etapa em uma loja-piloto antes de liberar geral.

---

## 6. Perguntas para você decidir antes de eu planejar a Etapa 1

1. **Nome da área nova**: "Aprendizados da IA", "Preferências aprendidas" ou "Memória operacional da IA"?
2. **Confirmação do usuário**: aprendizado sugerido pelo feedback deve nascer **pausado** (você ativa) ou **ativo** (você pode pausar)?
3. **UTM**: quer que eu use o modelo sugerido acima como padrão ou prefere definir outro?
4. **Hierarquia**: ao "Aprovar plano", quer que as propostas filhas apareçam todas de uma vez em "Aguardando ação", ou em lotes (ex.: começa pelas campanhas de público quente)?

---

📌 **Status da entrega:** Diagnóstico em andamento — sem ação de escrita proposta ainda.

📝 **Documentação necessária ao implementar:** atualizar docs de Gestor de Tráfego IA (Layer 3) e mapa de UI (Layer 3 transversal) em cada etapa aprovada. Nenhum doc é alterado nesta auditoria.
