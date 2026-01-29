// =============================================
// TRANSLATE BUTTON - Botão temporário para tradução
// Para gravação de vídeo da Meta
// =============================================

import { useState, useEffect } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { enableTranslation, isTranslationEnabled } from '@/lib/simpleTranslator';

export function TranslateButton() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Verifica estado inicial
    setIsEnabled(isTranslationEnabled());
  }, []);

  const handleClick = () => {
    if (!isEnabled) {
      enableTranslation();
      setIsEnabled(true);
      // Salva preferência
      sessionStorage.setItem('translate_enabled', 'true');
    } else {
      // Desabilita removendo a flag e recarregando
      sessionStorage.removeItem('translate_enabled');
      window.location.reload();
    }
  };

  // Auto-ativa se estava habilitado antes do reload
  useEffect(() => {
    const wasEnabled = sessionStorage.getItem('translate_enabled') === 'true';
    if (wasEnabled && !isTranslationEnabled()) {
      enableTranslation();
      setIsEnabled(true);
    }
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isEnabled ? 'default' : 'ghost'}
          size="icon"
          onClick={handleClick}
          className={isEnabled ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isEnabled ? 'Disable Translation (EN→PT)' : 'Traduzir para Inglês'}
      </TooltipContent>
    </Tooltip>
  );
}
