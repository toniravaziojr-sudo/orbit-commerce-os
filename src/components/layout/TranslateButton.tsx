// =============================================
// TRANSLATE BUTTON v2.0 - Botão para tradução segura
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

  // Auto-ativa se estava habilitado antes do reload
  useEffect(() => {
    const wasEnabled = sessionStorage.getItem('orbit_translate') === 'true';
    if (wasEnabled && !isTranslationEnabled()) {
      enableTranslation();
      setIsEnabled(true);
    }
  }, []);

  const handleClick = () => {
    if (!isEnabled) {
      enableTranslation();
      setIsEnabled(true);
      sessionStorage.setItem('orbit_translate', 'true');
    } else {
      sessionStorage.removeItem('orbit_translate');
      window.location.reload();
    }
  };

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
        {isEnabled ? 'Disable Translation' : 'Translate to English'}
      </TooltipContent>
    </Tooltip>
  );
}
