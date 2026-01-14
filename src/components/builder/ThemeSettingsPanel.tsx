// =============================================
// THEME SETTINGS PANEL - Yampi-style theme configuration
// Overlay panel that keeps canvas visible
// Navigation: Pages, Header, Footer, Typography, Colors, Custom CSS
// =============================================

import { useState } from 'react';
import { ArrowLeft, ChevronRight, Palette, Type, FileCode, Layout, X, PanelTop, PanelBottom } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PagesSettings } from './theme-settings/PagesSettings';
import { TypographySettings } from './theme-settings/TypographySettings';
import { ColorsSettings } from './theme-settings/ColorsSettings';
import { CustomCSSSettings } from './theme-settings/CustomCSSSettings';
import { PageSettingsContent } from './theme-settings/PageSettingsContent';
import { HeaderSettings } from './theme-settings/HeaderSettings';
import { FooterSettings } from './theme-settings/FooterSettings';

interface ThemeSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
}

type SettingsView = 'menu' | 'pages' | 'header' | 'footer' | 'typography' | 'colors' | 'css' | 'page-detail';

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
    id: 'header',
    label: 'Cabeçalho',
    icon: <PanelTop className="h-4 w-4" />,
    description: 'Configurações do cabeçalho',
  },
  {
    id: 'footer',
    label: 'Rodapé',
    icon: <PanelBottom className="h-4 w-4" />,
    description: 'Configurações do rodapé',
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
  const [selectedPageType, setSelectedPageType] = useState<string | null>(null);

  const handleBack = () => {
    if (currentView === 'page-detail') {
      setCurrentView('pages');
      setSelectedPageType(null);
    } else if (currentView === 'menu') {
      onOpenChange(false);
    } else {
      setCurrentView('menu');
    }
  };

  const handleClose = () => {
    setCurrentView('menu');
    setSelectedPageType(null);
    onOpenChange(false);
  };

  const handlePageSelect = (pageType: string) => {
    setSelectedPageType(pageType);
    setCurrentView('page-detail');
  };

  const handleNavigateToPage = (pageType: string) => {
    handleClose();
    onNavigateToPage?.(pageType);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'pages':
        return (
          <PagesSettings 
            tenantId={tenantId} 
            templateSetId={templateSetId}
            onNavigateToPage={handleNavigateToPage}
            onPageSelect={handlePageSelect}
          />
        );
      case 'page-detail':
        return selectedPageType ? (
          <PageSettingsContent
            tenantId={tenantId}
            pageType={selectedPageType}
            onNavigateToEdit={() => handleNavigateToPage(selectedPageType)}
          />
        ) : null;
      case 'header':
        return <HeaderSettings tenantId={tenantId} templateSetId={templateSetId} />;
      case 'footer':
        return <FooterSettings tenantId={tenantId} templateSetId={templateSetId} />;
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
      case 'page-detail':
        return getPageLabel(selectedPageType);
      case 'header':
        return 'Cabeçalho';
      case 'footer':
        return 'Rodapé';
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

  if (!open) return null;

  return (
    <>
      {/* Semi-transparent overlay - visual only, pointer-events disabled to allow canvas interaction */}
      {/* Close only via X button, ArrowLeft - Yampi style */}
      <div 
        className="fixed inset-0 bg-black/10 z-40 transition-opacity duration-200 pointer-events-none"
        aria-hidden="true"
      />
      
      {/* Sliding panel */}
      <div 
        className={cn(
          'fixed left-0 top-0 h-full w-80 bg-background border-r shadow-xl z-50',
          'transform transition-transform duration-200 ease-out pointer-events-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm flex-1">{getTitle()}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-57px)]">
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
      </div>
    </>
  );
}

// Helper to get page label
function getPageLabel(pageType: string | null): string {
  const labels: Record<string, string> = {
    home: 'Página Inicial',
    category: 'Categoria',
    product: 'Produto',
    cart: 'Carrinho',
    checkout: 'Checkout',
    thank_you: 'Obrigado',
    account: 'Minha Conta',
    account_orders: 'Pedidos',
    account_order_detail: 'Pedido',
    tracking: 'Rastreio',
    blog: 'Blog',
  };
  return labels[pageType || ''] || 'Página';
}
