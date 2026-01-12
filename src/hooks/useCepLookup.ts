import { useState, useCallback } from 'react';

interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  erro?: boolean;
}

interface AddressFromCep {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge_code: string;
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupCep = useCallback(async (cep: string): Promise<AddressFromCep | null> => {
    // Limpar CEP (remover caracteres não numéricos)
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar CEP');
      }

      const data: CepResult = await response.json();

      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }

      return {
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
        ibge_code: data.ibge,
      };
    } catch (err) {
      setError('Erro ao buscar CEP');
      console.error('CEP lookup error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    lookupCep,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
