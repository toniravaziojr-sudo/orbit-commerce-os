import type { LPFaqProps } from '@/lib/landing-page-schema';
import { useLPScrollReveal } from '@/hooks/useLPScrollReveal';
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
  const revealRef = useLPScrollReveal();

  return (
    <section ref={revealRef} className="px-[5%] py-16 md:py-24 lp-noise" style={{ background: 'var(--lp-bg)' }}>
      <div className="text-center max-w-[700px] mx-auto mb-14 lp-reveal">
        <span
          className="lp-badge-pulse inline-block px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-5"
          style={{ 
            background: 'var(--lp-badge-bg)', 
            color: 'var(--lp-badge-text)',
            border: '1px solid var(--lp-card-border)',
          }}
        >
          {data.badge}
        </span>
        <h2
          className="font-extrabold leading-tight"
          style={{ 
            color: 'var(--lp-text)', 
            fontFamily: 'var(--lp-font-display)',
            fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
          }}
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
              className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} rounded-xl px-6 overflow-hidden relative transition-all duration-300 hover:-translate-y-0.5`}
              style={{ 
                background: 'var(--lp-card-bg)',
                border: '1px solid var(--lp-card-border)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Glass highlight */}
              <div 
                className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
              />
              <AccordionTrigger
                className="text-left text-base font-semibold hover:no-underline py-5"
                style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)' }}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.75' }}
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
