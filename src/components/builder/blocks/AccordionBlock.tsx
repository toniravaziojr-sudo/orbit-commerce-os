import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface AccordionItemData {
  id?: string;
  title: string;
  content: string;
}

interface AccordionBlockProps {
  title?: string;
  subtitle?: string;
  items: AccordionItemData[];
  allowMultiple?: boolean;
  defaultOpen?: number; // -1 for all closed, 0+ for specific item
  variant?: 'default' | 'separated' | 'bordered';
  backgroundColor?: string;
  accentColor?: string;
}

export function AccordionBlock({
  title,
  subtitle,
  items = [],
  allowMultiple = false,
  defaultOpen = -1,
  variant = 'default',
  backgroundColor = 'transparent',
  accentColor = '#1a1a1a',
}: AccordionBlockProps) {
  const defaultValue = defaultOpen >= 0 && defaultOpen < items.length 
    ? [`item-${defaultOpen}`] 
    : [];

  const variantClasses = {
    default: '',
    separated: 'space-y-3',
    bordered: 'border rounded-lg divide-y',
  };

  const itemClasses = {
    default: 'border-b',
    separated: 'border rounded-lg bg-card',
    bordered: '',
  };

  return (
    <section 
      className="py-10 md:py-14 px-4"
      style={{ backgroundColor }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-8">
            {title && (
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Accordion */}
        {items.length > 0 ? (
          allowMultiple ? (
          <Accordion
            type="multiple"
            defaultValue={defaultValue}
            className={variantClasses[variant]}
          >
            {items.map((item, index) => (
              <AccordionItem
                key={item.id || index}
                value={`item-${index}`}
                className={cn(itemClasses[variant], variant === 'separated' && 'px-4')}
              >
                <AccordionTrigger 
                  className="text-left hover:no-underline py-4"
                  style={{ '--accent-color': accentColor } as React.CSSProperties}
                >
                  <span className="font-medium text-foreground pr-4">
                    {item.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-muted-foreground">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          ) : (
          <Accordion
            type="single"
            defaultValue={defaultValue[0]}
            collapsible
            className={variantClasses[variant]}
          >
            {items.map((item, index) => (
              <AccordionItem
                key={item.id || index}
                value={`item-${index}`}
                className={cn(itemClasses[variant], variant === 'separated' && 'px-4')}
              >
                <AccordionTrigger 
                  className="text-left hover:no-underline py-4"
                  style={{ '--accent-color': accentColor } as React.CSSProperties}
                >
                  <span className="font-medium text-foreground pr-4">
                    {item.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-muted-foreground">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          )
        ) : (
          <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            Adicione itens ao acordeão
          </div>
        )}
      </div>
    </section>
  );
}

export default AccordionBlock;
