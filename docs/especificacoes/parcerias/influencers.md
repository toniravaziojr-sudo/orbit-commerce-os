# Influencers — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-19

> **Camada:** Layer 3 — Especificações / Parcerias  
> **Migrado de:** `docs/regras/influencers.md`  
> **Última atualização:** 2026-04-03


---

## Visão Geral

Módulo de prospecção e gestão de influenciadores para campanhas de marketing.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/Influencers.tsx` | Interface de busca/gestão |
| `src/hooks/useInfluencerLeads.ts` | Hook CRUD |

## Tabelas

### influencer_leads

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome |
| `platform` | TEXT | `instagram`, `tiktok`, `youtube` |
| `handle` | TEXT | @ do perfil |
| `niche` | TEXT | Nicho/segmento |
| `followers` | INT | Número de seguidores |
| `status` | TEXT | `prospect`, `contacted`, `partner` |

### influencer_interactions

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `influencer_id` | UUID | FK influencer_leads |
| `type` | TEXT | `note`, `call`, `email` |
| `content` | TEXT | Conteúdo da interação |

## Status Flow

```
prospect → contacted → partner
```
