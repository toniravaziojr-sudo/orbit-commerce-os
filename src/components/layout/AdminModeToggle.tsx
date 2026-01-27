import { Building2, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAdminMode, AdminMode } from '@/contexts/AdminModeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ModeOption {
  mode: AdminMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultRoute: string;
}

const modes: ModeOption[] = [
  {
    mode: 'platform',
    label: 'Plataforma',
    icon: Building2,
    description: 'Administração do Comando Central',
    defaultRoute: '/platform/health-monitor',
  },
  {
    mode: 'store',
    label: 'Minha Loja',
    icon: Store,
    description: 'Ferramentas de loja e e-commerce',
    defaultRoute: '/command-center',
  },
];

/**
 * Toggle pills para alternar entre modo Plataforma e Minha Loja.
 * Apenas visível para platform operators.
 * Ao alternar, navega automaticamente para o primeiro módulo do modo.
 */
export function AdminModeToggle() {
  const navigate = useNavigate();
  const { mode, setMode, canSwitchMode } = useAdminMode();

  // Only show for platform operators
  if (!canSwitchMode) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {modes.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.mode;

        const handleClick = () => {
          if (mode !== option.mode) {
            setMode(option.mode);
            navigate(option.defaultRoute);
          }
        };

        return (
          <Tooltip key={option.mode} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={handleClick}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {option.description}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
