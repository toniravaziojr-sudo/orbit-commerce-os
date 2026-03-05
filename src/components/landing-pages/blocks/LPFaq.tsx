import type { LPFaqProps } from '@/lib/landing-page-schema';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Props {
  data: LPFaqProps;
}

export function LPFaq({ data }: Props) {
  return (
    <section className="px-[5%] py-12 md:py-20" style={{ background: 'var(--lp-bg)' }}>
      <div className="text-center max-w-[700px] mx-auto mb-12">
        <span
          className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{ background: 'var(--lp-badge-bg)', color: 'var(--lp-badge-text)' }}
        >
          {data.badge}
        </span>
        <h2
          className="text-2xl md:text-4xl font-extrabold leading-tight"
          style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)' }}
        >
          {data.title}
        </h2>
      </div>
      <div className="max-w-[750px] mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {data.items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              style={{ borderColor: 'var(--lp-divider)' }}
            >
              <AccordionTrigger
                className="text-left text-base font-semibold hover:no-underline"
                style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)' }}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)' }}
                >
                  {item.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
