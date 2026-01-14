// =============================================
// THEME SETTINGS PANEL - Yampi-style theme configuration
// Navigation: Pages, Typography, Colors, Custom CSS
// =============================================

import { useState } from 'react';
import { ArrowLeft, ChevronRight, Palette, Type, FileCode, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PagesSettings } from './theme-settings/PagesSettings';
import { TypographySettings } from './theme-settings/TypographySettings';
import { ColorsSettings } from './theme-settings/ColorsSettings';
import { CustomCSSSettings } from './theme-settings/CustomCSSSettings';

interface ThemeSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
}

type SettingsView = 'menu' | 'pages' | 'typography' | 'colors' | 'css';

interface MenuItem {
  id: SettingsView;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'pages',
    label: 'Páginas',
    icon: <Layout className="h-4 w-4" />,
    description: 'Configurações por página',
  },
  {
    id: 'colors',
    label: 'Cores',
    icon: <Palette className="h-4 w-4" />,
    description: 'Paleta de cores do tema',
  },
  {
    id: 'typography',
    label: 'Tipografia',
    icon: <Type className="h-4 w-4" />,
    description: 'Fontes e tamanhos',
  },
  {
    id: 'css',
    label: 'CSS customizado',
    icon: <FileCode className="h-4 w-4" />,
    description: 'Estilos avançados',
  },
];

export function ThemeSettingsPanel({
  open,
  onOpenChange,
  tenantId,
  templateSetId,
  onNavigateToPage,
}: ThemeSettingsPanelProps) {
  const [currentView, setCurrentView] = useState<SettingsView>('menu');

  const handleBack = () => {
    if (currentView === 'menu') {
      onOpenChange(false);
    } else {
      setCurrentView('menu');
    }
  };

  const handleClose = () => {
    setCurrentView('menu');
    onOpenChange(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'pages':
        return (
          <PagesSettings 
            tenantId={tenantId} 
            templateSetId={templateSetId}
            onNavigateToPage={(pageType) => {
              handleClose();
              onNavigateToPage?.(pageType);
            }}
          />
        );
      case 'typography':
        return <TypographySettings tenantId={tenantId} templateSetId={templateSetId} />;
      case 'colors':
        return <ColorsSettings tenantId={tenantId} templateSetId={templateSetId} />;
      case 'css':
        return <CustomCSSSettings tenantId={tenantId} templateSetId={templateSetId} />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'pages':
        return 'Páginas';
      case 'typography':
        return 'Tipografia';
      case 'colors':
        return 'Cores';
      case 'css':
        return 'CSS customizado';
      default:
        return 'Configurações do tema';
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle>{getTitle()}</SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-65px)]">
          {currentView === 'menu' ? (
            <div className="p-2 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-lg',
                    'hover:bg-muted transition-colors text-left group'
                  )}
                >
                  <div className="flex-shrink-0 text-muted-foreground">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4">
              {renderContent()}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
