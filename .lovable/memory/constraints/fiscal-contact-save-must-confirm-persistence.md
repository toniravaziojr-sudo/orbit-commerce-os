---
name: Fiscal Contact Save Must Confirm Persistence
description: Salvamento do contato do emitente nunca pode retornar sucesso sem confirmar persistência real de e-mail e telefone.
type: constraint
---

**Regra:** o salvamento do contato do emitente deve confirmar persistência real antes de responder sucesso.

**Obrigação:** sempre que e-mail e/ou telefone do emitente forem salvos, o backend precisa normalizar os valores, gravar, reler a configuração e comparar o que foi persistido com o que foi enviado. Se houver divergência, deve retornar erro explícito e registrar diagnóstico, sem exibir sucesso na UI.

**Why:** evita falso positivo de salvamento, checklist inconsistente e usuário acreditando que o contato fiscal foi gravado quando o banco continuou vazio.

**How to apply:** qualquer ajuste futuro no fluxo fiscal de configuração, sync ou UI que envolva contato do emitente deve preservar essa confirmação pós-gravação.