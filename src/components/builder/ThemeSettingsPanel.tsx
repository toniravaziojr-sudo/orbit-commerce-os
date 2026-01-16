// =============================================
// THEME SETTINGS PANEL - Yampi-style theme configuration
// Overlay panel that keeps canvas visible
// Navigation: Pages, Header, Footer, Typography, Colors, Custom CSS
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Palette, Type, FileCode, Layout, X, PanelTop, PanelBottom, ShoppingCart } from 'lucide-react';
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
import { MiniCartSettings } from './theme-settings/MiniCartSettings';

import { MiniCartConfig } from './theme-settings/MiniCartSettings';

interface ThemeSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
  showMiniCartPreview?: boolean;
  onToggleMiniCartPreview?: (open: boolean) => void;
  onMiniCartConfigChange?: (config: MiniCartConfig) => void;
}

type SettingsView = 'menu' | 'pages' | 'header' | 'footer' | 'mini-cart' | 'typography' | 'colors' | 'css' | 'page-detail';

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
    id: 'mini-cart',
    label: 'Carrinho Suspenso',
    icon: <ShoppingCart className="h-4 w-4" />,
    description: 'Mini-carrinho lateral',
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
  showMiniCartPreview,
  onToggleMiniCartPreview,
  onMiniCartConfigChange,
}: ThemeSettingsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Preserve view and selected page via URL params to survive re-renders
  const viewFromUrl = searchParams.get('settingsView') as SettingsView | null;
  const pageFromUrl = searchParams.get('settingsPage');
  
  const [currentView, setCurrentViewInternal] = useState<SettingsView>(viewFromUrl || 'menu');
  const [selectedPageType, setSelectedPageTypeInternal] = useState<string | null>(pageFromUrl);

  // Sync view state with URL - uses functional update to avoid stale params
  const updateUrlParams = useCallback((updates: { view?: SettingsView; page?: string | null }) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      
      if (updates.view !== undefined) {
        if (updates.view === 'menu') {
          newParams.delete('settingsView');
          newParams.delete('settingsPage');
        } else {
          newParams.set('settingsView', updates.view);
        }
      }
      
      if (updates.page !== undefined) {
        if (updates.page) {
          newParams.set('settingsPage', updates.page);
        } else {
          newParams.delete('settingsPage');
        }
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const setCurrentView = useCallback((view: SettingsView) => {
    setCurrentViewInternal(view);
    updateUrlParams({ view });
  }, [updateUrlParams]);

  const setSelectedPageType = useCallback((pageType: string | null) => {
    setSelectedPageTypeInternal(pageType);
    updateUrlParams({ page: pageType });
  }, [updateUrlParams]);

  // Combined setter for page selection (avoids race condition)
  const setPageAndView = useCallback((pageType: string, view: SettingsView) => {
    setCurrentViewInternal(view);
    setSelectedPageTypeInternal(pageType);
    updateUrlParams({ view, page: pageType });
  }, [updateUrlParams]);

  // Sync from URL on mount/change (important for page navigation)
  useEffect(() => {
    if (viewFromUrl && viewFromUrl !== currentView) {
      setCurrentViewInternal(viewFromUrl);
    }
    if (pageFromUrl !== undefined && pageFromUrl !== selectedPageType) {
      setSelectedPageTypeInternal(pageFromUrl);
    }
  }, [viewFromUrl, pageFromUrl]);

  const handleBack = () => {
    if (currentView === 'page-detail') {
      // Use combined update to clear both at once
      setCurrentViewInternal('pages');
      setSelectedPageTypeInternal(null);
      updateUrlParams({ view: 'pages', page: null });
    } else if (currentView === 'menu') {
      onOpenChange(false);
    } else {
      setCurrentView('menu');
    }
  };

  const handleClose = () => {
    // Clear all state at once
    setCurrentViewInternal('menu');
    setSelectedPageTypeInternal(null);
    updateUrlParams({ view: 'menu', page: null });
    onOpenChange(false);
  };

  // AJUSTE 2: Ao selecionar página no theme settings, navegamos automaticamente para ela
  // Isso permite preview em tempo real das configurações
  const handlePageSelect = (pageType: string) => {
    // Use combined setter to avoid race condition between view and page params
    setPageAndView(pageType, 'page-detail');
    // Navegar automaticamente para a página selecionada para ver mudanças em tempo real
    onNavigateToPage?.(pageType);
  };

  const handleNavigateToPage = (pageType: string) => {
    // Não fecha o painel ao navegar - mantém aberto para continuar editando
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
            templateSetId={templateSetId}
            pageType={selectedPageType}
            onNavigateToEdit={() => handleNavigateToPage(selectedPageType)}
          />
        ) : null;
      case 'header':
        return <HeaderSettings tenantId={tenantId} templateSetId={templateSetId} />;
      case 'footer':
        return <FooterSettings tenantId={tenantId} templateSetId={templateSetId} />;
      case 'mini-cart':
        return (
          <MiniCartSettings 
            tenantId={tenantId} 
            templateSetId={templateSetId} 
            onNavigateToPage={onNavigateToPage}
            showPreview={showMiniCartPreview}
            onTogglePreview={onToggleMiniCartPreview}
            onConfigChange={onMiniCartConfigChange}
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
      case 'page-detail':
        return getPageLabel(selectedPageType);
      case 'header':
        return 'Cabeçalho';
      case 'footer':
        return 'Rodapé';
      case 'mini-cart':
        return 'Carrinho Suspenso';
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
        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-background"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm flex-1 text-foreground">{getTitle()}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-background"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-57px)]">
          {currentView === 'menu' ? (
            <div className="p-3 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-lg',
                    'hover:bg-primary hover:text-primary-foreground transition-all text-left group',
                    'border border-transparent hover:border-primary/20 hover:shadow-sm'
                  )}
                >
                  <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary-foreground">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/80 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground group-hover:translate-x-0.5 transition-transform" />
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
