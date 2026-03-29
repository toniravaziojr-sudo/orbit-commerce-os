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
    <section ref={revealRef} className="px-[5%] py-24 md:py-36 lp-noise" style={{ background: 'var(--lp-bg)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 70% 30%, var(--lp-accent) 0%, transparent 50%)`, opacity: 0.03 }} />

      <div className="text-center max-w-[700px] mx-auto mb-16 lp-reveal">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] mb-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))', color: 'var(--lp-badge-text)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)' }}>
          <span className="w-2 h-2 rounded-full lp-dot-pulse" style={{ background: 'var(--lp-accent)' }} />
          {data.badge}
        </span>
        <h2 className="font-extrabold leading-[1.05] tracking-[-0.02em]" style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.75rem)' }}>
          <span className="lp-gradient-text">{data.title}</span>
        </h2>
      </div>

      <div className="max-w-[750px] mx-auto">
        <Accordion type="single" collapsible className="w-full space-y-4">
          {data.items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className={`lp-reveal lp-reveal-delay-${Math.min(i + 1, 4)} rounded-2xl px-7 overflow-hidden relative transition-all duration-300 hover:-translate-y-0.5 lp-glass-card`}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              {/* Top shine */}
              <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />
              <AccordionTrigger
                className="text-left text-base font-semibold hover:no-underline py-6"
                style={{ color: 'var(--lp-text)', fontFamily: 'var(--lp-font-body)' }}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)', fontFamily: 'var(--lp-font-body)', lineHeight: '1.8' }}>
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