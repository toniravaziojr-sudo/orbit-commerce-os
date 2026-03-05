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
    <section className="px-[5%] py-16 md:py-24" style={{ background: 'var(--lp-bg)' }}>
      <div className="text-center max-w-[700px] mx-auto mb-14">
        <span
          className="inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-badge-text)',
            border: '1px solid var(--lp-card-border)',
          }}
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
        <Accordion type="single" collapsible className="w-full space-y-3">
          {data.items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-xl px-6 overflow-hidden"
              style={{ 
                background: 'var(--lp-card-bg)',
                border: '1px solid var(--lp-card-border)',
              }}
            >
              <AccordionTrigger
                className="text-left text-base font-semibold hover:no-underline py-5"
                style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)' }}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5">
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
