import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type EntityType = 'order' | 'customer' | 'product' | 'invoice' | 'fiscal-product';

interface EntityLinkProps {
  type: EntityType;
  id: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
  openInNewTab?: boolean;
}

const ENTITY_ROUTES: Record<EntityType, (id: string) => string> = {
  order: (id) => `/orders/${id}`,
  customer: (id) => `/customers/${id}`,
  product: (id) => `/products?edit=${id}`,
  invoice: (id) => `/fiscal?invoice=${id}`,
  'fiscal-product': (id) => `/fiscal/products?product=${id}`,
};

export function EntityLink({
  type,
  id,
  children,
  className,
  showIcon = false,
  openInNewTab = false,
}: EntityLinkProps) {
  const path = ENTITY_ROUTES[type](id);
  
  if (openInNewTab) {
    return (
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'text-primary hover:underline inline-flex items-center gap-1',
          className
        )}
      >
        {children}
        {showIcon && <ExternalLink className="h-3 w-3" />}
      </a>
    );
  }
  
  return (
    <Link
      to={path}
      className={cn(
        'text-primary hover:underline inline-flex items-center gap-1',
        className
      )}
    >
      {children}
      {showIcon && <ExternalLink className="h-3 w-3" />}
    </Link>
  );
}
