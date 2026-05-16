## Plano final — Onda 2-B (grade horária unificada)

### Nova grade padrão para sincronizações de painéis externos

Todos os sincronismos abaixo passam a rodar **7× por dia**, nos horários fixos:

**00h, 06h, 09h, 12h, 15h, 18h, 21h**

(De 3 em 3 horas durante o dia. Madrugada — entre 00h e 06h — só uma execução, às 6h.)

---

### Itens afetados

| # | Sincronização | Hoje | Depois |
|---|---|---|---|
| 1 | Painel de anúncios (Meta + Google) | 1× por hora (24/dia) | 7×/dia na nova grade |
| 2 | Refresh de token Meta | 1× por dia às 3h | **Mantido sem alteração** |
| 3 | Sincronização de anúncios/estoque do Mercado Livre | de 2 em 2 horas (12/dia) | 7×/dia na nova grade |

**Observação importante:** pedidos do Mercado Livre e da loja própria já chegam em tempo real via notificação automática — não dependem desses crons e continuam instantâneos.

---

### Economia esperada de Cloud

| Bloco | Economia adicional |
|---|---|
| Já feito anteriormente | ~3–5% |
| Onda 1 (aprovada antes) | +10–16% |
| Onda 2-B (esta entrega) | +3–5% |
| **Total acumulado possível** | **~16–26%** |

---

### O que será atualizado na documentação

- Tabela de frequências em **Recursos em Uso e Crons Adormecidos** (linhas dos 2 crons alterados).
- Memória de governança anti-regressão registrando a **grade horária unificada (00, 06, 09, 12, 15, 18, 21)** como padrão oficial para sincronizações de painéis externos não-críticos. Isso impede que futuras alterações voltem a colocar esses sincronismos rodando o dia todo sem necessidade.

---

### Validação técnica após aplicar

1. Confirmar que os dois agendamentos foram reescritos com sucesso (consulta direta ao agendador).
2. Acompanhar a primeira janela diurna (próxima execução às 9h, 12h ou 15h) para confirmar que rodaram normalmente.
3. Confirmar que entre 00h01 e 05h59 nenhum desses dois sincronismos disparou.

---

### Pronto para executar?

Se confirmar, eu aplico os dois ajustes na mesma janela, atualizo o documento oficial e registro a memória anti-regressão.
