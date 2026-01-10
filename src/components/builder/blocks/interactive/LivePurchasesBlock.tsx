// =============================================
// LIVE PURCHASES BLOCK - Real-time sales notifications
// =============================================

import React, { useState, useEffect } from 'react';
import { ShoppingCart, MapPin, Clock, Users, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseNotification {
  id?: string;
  customerName?: string;
  city?: string;
  state?: string;
  productName?: string;
  productImage?: string;
  timeAgo?: string;
}

interface LivePurchasesBlockProps {
  title?: string;
  layout?: 'ticker' | 'cards' | 'minimal' | 'popup';
  showStats?: boolean;
  purchasesToday?: number;
  viewersNow?: number;
  notifications?: PurchaseNotification[];
  autoPlay?: boolean;
  interval?: number;
  isEditing?: boolean;
}

const defaultNotifications: PurchaseNotification[] = [
  {
    id: '1',
    customerName: 'Maria S.',
    city: 'São Paulo',
    state: 'SP',
    productName: 'Camiseta Premium Preta',
    productImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=80&h=80&fit=crop',
    timeAgo: 'agora mesmo',
  },
  {
    id: '2',
    customerName: 'João P.',
    city: 'Rio de Janeiro',
    state: 'RJ',
    productName: 'Tênis Esportivo Branco',
    productImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    timeAgo: '2 min atrás',
  },
  {
    id: '3',
    customerName: 'Ana C.',
    city: 'Belo Horizonte',
    state: 'MG',
    productName: 'Bolsa de Couro Marrom',
    productImage: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=80&h=80&fit=crop',
    timeAgo: '5 min atrás',
  },
  {
    id: '4',
    customerName: 'Carlos M.',
    city: 'Curitiba',
    state: 'PR',
    productName: 'Relógio Smartwatch',
    productImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop',
    timeAgo: '8 min atrás',
  },
];

export function LivePurchasesBlock({
  title = 'Comprando Agora',
  layout = 'cards',
  showStats = true,
  purchasesToday = 127,
  viewersNow = 43,
  notifications,
  autoPlay = true,
  interval = 4000,
  isEditing = false,
}: LivePurchasesBlockProps) {
  const displayNotifications = notifications?.length ? notifications : defaultNotifications;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Auto-rotate notifications
  useEffect(() => {
    if (!autoPlay || isEditing) return;
    
    const timer = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % displayNotifications.length);
        setIsVisible(true);
      }, 300);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, displayNotifications.length, isEditing]);

  // Layout: Ticker (barra horizontal)
  if (layout === 'ticker') {
    return (
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-y border-primary/20 py-3 overflow-hidden">
        <div className="flex items-center gap-8 animate-marquee">
          {[...displayNotifications, ...displayNotifications].map((notification, index) => (
            <div key={index} className="flex items-center gap-3 whitespace-nowrap">
              <div className="flex items-center gap-1.5 text-primary">
                <Zap className="w-4 h-4" />
                <span className="font-medium text-sm">{notification.customerName}</span>
              </div>
              <span className="text-muted-foreground text-sm">comprou</span>
              <span className="font-medium text-foreground text-sm">{notification.productName}</span>
              <span className="text-muted-foreground text-xs">• {notification.timeAgo}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Layout: Minimal (popup estilo)
  if (layout === 'minimal' || layout === 'popup') {
    const current = displayNotifications[currentIndex];
    return (
      <div className="fixed bottom-4 left-4 z-50 max-w-xs">
        <div
          className={cn(
            'bg-card border border-border rounded-xl shadow-2xl p-4 transition-all duration-300',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          <div className="flex items-start gap-3">
            {current.productImage && (
              <img
                src={current.productImage}
                alt=""
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Compra realizada
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {current.customerName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {current.productName}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {current.city}, {current.state}
                <span className="mx-1">•</span>
                <Clock className="w-3 h-3" />
                {current.timeAgo}
              </div>
            </div>
          </div>
        </div>
        
        {isEditing && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            ⚡ Preview do popup de compras
          </p>
        )}
      </div>
    );
  }

  // Layout: Cards (padrão)
  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header com stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20">
                <ShoppingCart className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">Vendas em tempo real</p>
            </div>
          </div>

          {showStats && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{purchasesToday}</p>
                  <p className="text-xs text-muted-foreground">vendas hoje</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{viewersNow}</p>
                  <p className="text-xs text-muted-foreground">visitantes agora</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid de notificações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayNotifications.slice(0, 4).map((notification, index) => (
            <div
              key={notification.id || index}
              className={cn(
                'bg-card rounded-xl border border-border p-4 transition-all duration-300',
                index === currentIndex && !isEditing && 'ring-2 ring-green-500/50 border-green-500/30'
              )}
            >
              <div className="flex items-start gap-3">
                {notification.productImage && (
                  <img
                    src={notification.productImage}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                    <span className={cn(
                      'w-2 h-2 rounded-full bg-green-500',
                      index === currentIndex && !isEditing && 'animate-pulse'
                    )} />
                    {notification.timeAgo}
                  </div>
                  <p className="font-medium text-foreground text-sm truncate">
                    {notification.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.productName}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {notification.city}, {notification.state}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-sm text-muted-foreground text-center">
              ⚡ Em produção, as notificações serão atualizadas em tempo real com as vendas da loja
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
