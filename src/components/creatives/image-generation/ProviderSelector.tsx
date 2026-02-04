/**
 * Seletor de Provedores de IA (OpenAI + Gemini)
 * Multi-select com validação
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Sparkles, Zap } from 'lucide-react';
import { ImageProvider } from './types';

interface ProviderSelectorProps {
  value: ImageProvider[];
  onChange: (providers: ImageProvider[]) => void;
  disabled?: boolean;
}

const PROVIDERS = [
  {
    id: 'openai' as ImageProvider,
    name: 'OpenAI',
    description: 'GPT Image — excelente em composição e realismo',
    icon: Sparkles,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    id: 'gemini' as ImageProvider,
    name: 'Gemini',
    description: 'Google Gemini — forte em cores e detalhes',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
];

export function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  const toggleProvider = (providerId: ImageProvider) => {
    if (value.includes(providerId)) {
      onChange(value.filter(p => p !== providerId));
    } else {
      onChange([...value, providerId]);
    }
  };

  const hasNoProviders = value.length === 0;
  const hasBothProviders = value.length === 2;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Provedores de IA</Label>
        {hasBothProviders && (
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
            🏆 Modo Recomendado
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => {
          const isSelected = value.includes(provider.id);
          const Icon = provider.icon;
          
          return (
            <div
              key={provider.id}
              onClick={() => !disabled && toggleProvider(provider.id)}
              className={`
                relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? `border-primary/50 ${provider.bgColor}` 
                  : 'border-border hover:border-muted-foreground/30'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Checkbox
                checked={isSelected}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-4 w-4 ${provider.color}`} />
                  <span className="font-medium text-sm">{provider.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {provider.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasNoProviders && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Selecione ao menos um provedor para gerar imagens.
          </AlertDescription>
        </Alert>
      )}

      {hasBothProviders && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          Ambos os provedores serão usados e o mais <strong>realista</strong> será selecionado automaticamente.
        </p>
      )}
    </div>
  );
}
