// =============================================
// FAQ BLOCK - Frequently Asked Questions accordion
// =============================================

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface FAQItem {
  question?: string;
  answer?: string;
}

interface FAQBlockProps {
  title?: string;
  items?: FAQItem[];
  isEditing?: boolean;
}

const defaultItems: FAQItem[] = [
  { question: 'Qual o prazo de entrega?', answer: 'O prazo varia de acordo com a região. Consulte no checkout.' },
  { question: 'Posso trocar ou devolver?', answer: 'Sim, em até 7 dias após o recebimento.' },
  { question: 'Quais formas de pagamento?', answer: 'Aceitamos cartão, PIX e boleto.' },
];

export function FAQBlock({ title = 'Perguntas Frequentes', items = defaultItems, isEditing }: FAQBlockProps) {
  const faqItems = items?.length > 0 ? items : defaultItems;

  return (
    <div className="py-8 container mx-auto px-4">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <Accordion type="single" collapsible className="w-full">
        {faqItems.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure as perguntas no painel lateral]
        </p>
      )}
    </div>
  );
}
