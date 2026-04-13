# Memory: governance/documentation-governance
Updated: 2026-04-13

## Regra de Ouro
Toda entrega que introduza, altere ou remova qualquer elemento do sistema (módulo, integração, regra, tela, rota, sidebar, fluxo) deve obrigatoriamente atualizar ou criar o doc correspondente. Nunca encerrar uma entrega sem verificar se os docs refletem o estado atual do sistema.

## Tipos de Documentação e Finalidade

### 1. Knowledge de Governança (Layer 1)
- **O que é:** Instruções do sistema (custom instructions) carregadas automaticamente.
- **Para que serve:** Define COMO a IA deve agir, responder, validar e encerrar entregas. É o filtro primário de comportamento.
- **Quem mantém:** Usuário define, IA segue.

### 2. Regras do Sistema (Layer 2) — `docs/REGRAS-DO-SISTEMA.md`
- **O que é:** Fonte de verdade para lógica de negócio e regras macro.
- **Para que serve:** Define fluxos, contratos entre módulos, fontes de verdade, segurança e fechamento. Tudo que é "como o sistema DEVE funcionar".
- **Quem mantém:** Usuário direciona, IA propõe atualizações com confirmação.
- **Leitura:** OBRIGATÓRIA antes de qualquer implementação.

### 3. Especificações Funcionais (Layer 3) — `docs/especificacoes/`
- **O que é:** Regras detalhadas por módulo/tema.
- **Para que serve:** Detalha o comportamento funcional de cada módulo (ex: checkout, marketing, suporte). Inclui o Mapa da UI (`mapa-ui.md`) como fonte de verdade para rotas, sidebar e guards.
- **Quem mantém:** Atualizado a cada entrega que impacte o módulo.
- **Leitura:** OBRIGATÓRIA antes de implementar no módulo correspondente.

### 4. Referência e Arquitetura (Layer 4) — `docs/IMPORT_MAP.md`, guias técnicos
- **O que é:** Mapas técnicos, inventário de componentes, arquitetura.
- **Para que serve:** Contexto amplo, referência de estrutura, evitar duplicação.
- **Quem mantém:** Atualizado quando há mudança estrutural significativa.

### 5. Base de Conhecimento Técnico — `docs/tecnico/base-de-conhecimento-tecnico.md`
- **O que é:** Registro de lições aprendidas (Problema → Causa → Solução).
- **Para que serve:** Anti-patterns e decisões técnicas definidas durante a construção. Evita reintrodução de bugs conhecidos.
- **Quem mantém:** IA registra decisões técnicas; usuário valida.
- **Leitura:** Consultado antes de correções e implementações.

### 6. Memórias (Layer 5) — `.lovable/memory/`
- **O que é:** Arquivos `.md` curtos injetados automaticamente por relevância de contexto.
- **Para que serve:** Referência rápida de arquitetura, decisões passadas e regras críticas. Funciona como "lembrete permanente" para a IA.
- **Quem mantém:** IA cria e atualiza; usuário pode direcionar o conteúdo.
- **Regra:** Memória NÃO substitui doc formal. Serve como ponteiro e resumo.

## Checklist de Fechamento Documental
Toda entrega deve terminar verificando:
- [ ] Docs impactados foram atualizados (ou lacuna declarada)
- [ ] Mapa da UI atualizado se houve mudança de tela/rota/sidebar
- [ ] Base de conhecimento técnico atualizada se houve lição aprendida
- [ ] Memórias atualizadas se houve decisão arquitetural relevante
