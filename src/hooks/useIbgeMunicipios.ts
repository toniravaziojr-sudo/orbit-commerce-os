// =============================================
// useIbgeMunicipios — Lista oficial de municípios de uma UF (IBGE Localidades API)
// Cache em sessionStorage para performance (lista de UF não muda durante a sessão).
// =============================================

import { useEffect, useState } from 'react';

export interface Municipio {
  id: number; // código IBGE (7 dígitos)
  nome: string;
}

const CACHE_PREFIX = 'ibge_municipios_v1:';

async function fetchMunicipios(uf: string): Promise<Municipio[]> {
  const cacheKey = `${CACHE_PREFIX}${uf}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Municipio[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore cache errors
  }

  const resp = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
  );
  if (!resp.ok) throw new Error('Falha ao consultar municípios do IBGE');
  const data = await resp.json();
  const mapped: Municipio[] = (data || []).map((m: any) => ({
    id: Number(m.id),
    nome: String(m.nome),
  }));

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
  } catch {
    // ignore quota errors
  }

  return mapped;
}

export function useIbgeMunicipios(uf: string | null | undefined) {
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!uf || uf.length !== 2) {
      setMunicipios([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetchMunicipios(uf.toUpperCase())
      .then((list) => {
        if (!cancelled) setMunicipios(list);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useIbgeMunicipios]', err);
          setError('Não foi possível carregar a lista de cidades.');
          setMunicipios([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uf]);

  return { municipios, isLoading, error };
}
