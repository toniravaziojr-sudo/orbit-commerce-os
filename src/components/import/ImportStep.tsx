import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, SkipForward, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImportStepConfig {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  required?: boolean;
  requiresPrevious?: string[];
  canSkip?: boolean;
}

interface ImportStepProps {
  step: ImportStepConfig;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'processing';
  onImport: () => void;
  onSkip: () => void;
  isDisabled?: boolean;
  importedCount?: number;
  children?: ReactNode;
}

export function ImportStep({ 
  step, 
  status, 
  onImport, 
  onSkip, 
  isDisabled,
  importedCount,
  children 
}: ImportStepProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-primary" />;
      case 'skipped':
        return <SkipForward className="h-6 w-6 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
      case 'active':
        return <Circle className="h-6 w-6 text-primary fill-primary/20" />;
      default:
        return <Circle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return importedCount !== undefined 
          ? `${importedCount} itens importados`
          : 'Concluído';
      case 'skipped':
        return 'Pulado';
      case 'processing':
        return 'Importando...';
      default:
        return '';
    }
  };

  return (
    <div 
      className={cn(
        "border rounded-lg p-4 transition-all",
        status === 'active' && "border-primary bg-primary/5",
        status === 'completed' && "border-primary/50 bg-primary/5",
        status === 'skipped' && "opacity-60",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {getStatusIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{step.title}</h4>
            {step.required && (
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                Obrigatório
              </span>
            )}
            {step.canSkip && status !== 'completed' && status !== 'skipped' && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                Opcional
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          
          {status !== 'pending' && status !== 'active' && (
            <p className="text-xs text-muted-foreground mt-1">{getStatusText()}</p>
          )}

          {status === 'active' && (
            <div className="mt-4 space-y-4">
              {children}
              
              <div className="flex gap-2">
              <Button 
                onClick={onImport} 
                disabled={isDisabled}
                size="sm"
              >
                Importar
              </Button>
                
                {step.canSkip && (
                  <Button 
                    variant="ghost" 
                    onClick={onSkip}
                    disabled={isDisabled}
                    size="sm"
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    Pular
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
