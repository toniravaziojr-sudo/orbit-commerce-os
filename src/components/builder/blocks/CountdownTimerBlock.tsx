import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerBlockProps {
  title?: string;
  subtitle?: string;
  endDate: string; // ISO date string
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  expiredMessage?: string;
  buttonText?: string;
  buttonUrl?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimerBlock({
  title = 'Oferta por tempo limitado',
  subtitle,
  endDate,
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
  backgroundColor = '#dc2626',
  textColor = '#ffffff',
  accentColor = '#ffffff',
  expiredMessage = 'Oferta encerrada',
  buttonText,
  buttonUrl,
}: CountdownTimerBlockProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [noDateConfigured, setNoDateConfigured] = useState(false);

  useEffect(() => {
    if (!endDate) {
      setNoDateConfigured(true);
      setIsExpired(false);
      return;
    }

    setNoDateConfigured(false);
    const targetDate = new Date(endDate).getTime();

    // Check if date is valid
    if (isNaN(targetDate)) {
      setNoDateConfigured(true);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        return;
      }

      setIsExpired(false);
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div 
        className="text-3xl md:text-5xl font-bold px-3 md:px-5 py-2 md:py-3 rounded-lg mb-1"
        style={{ 
          backgroundColor: `${accentColor}20`,
          color: textColor,
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span 
        className="text-xs md:text-sm uppercase tracking-wide opacity-80"
        style={{ color: textColor }}
      >
        {label}
      </span>
    </div>
  );

  const Separator = () => (
    <span 
      className="text-3xl md:text-5xl font-bold mx-1 md:mx-2"
      style={{ color: textColor }}
    >
      :
    </span>
  );

  return (
    <section 
      className="py-8 md:py-12 px-4"
      style={{ backgroundColor }}
    >
      <div className="max-w-4xl mx-auto text-center">
        {/* Title */}
        {title && (
          <h2 
            className="text-xl md:text-3xl font-bold mb-2"
            style={{ color: textColor }}
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p 
            className="text-sm md:text-base mb-6 opacity-90"
            style={{ color: textColor }}
          >
            {subtitle}
          </p>
        )}

        {/* Countdown or Expired Message or No Date */}
        {noDateConfigured ? (
          <div 
            className="text-lg md:text-xl opacity-80 py-4"
            style={{ color: textColor }}
          >
            <p className="font-medium">⏰ Configure a data de término</p>
            <p className="text-sm mt-1 opacity-70">Preencha o campo "Data de Término (ISO)" com uma data futura</p>
            <p className="text-xs mt-1 opacity-50">Exemplo: 2025-02-01T23:59:59</p>
          </div>
        ) : isExpired ? (
          <p 
            className="text-xl md:text-2xl font-semibold"
            style={{ color: textColor }}
          >
            {expiredMessage}
          </p>
        ) : timeLeft ? (
          <div className="flex items-center justify-center flex-wrap gap-1 md:gap-0">
            {showDays && (
              <>
                <TimeUnit value={timeLeft.days} label="Dias" />
                {(showHours || showMinutes || showSeconds) && <Separator />}
              </>
            )}
            {showHours && (
              <>
                <TimeUnit value={timeLeft.hours} label="Horas" />
                {(showMinutes || showSeconds) && <Separator />}
              </>
            )}
            {showMinutes && (
              <>
                <TimeUnit value={timeLeft.minutes} label="Min" />
                {showSeconds && <Separator />}
              </>
            )}
            {showSeconds && (
              <TimeUnit value={timeLeft.seconds} label="Seg" />
            )}
          </div>
        ) : null}

        {/* CTA Button */}
        {buttonText && (
          <a
            href={buttonUrl || '#'}
            className="inline-block mt-6 px-8 py-3 rounded-lg font-semibold transition-transform hover:scale-105"
            style={{ 
              backgroundColor: textColor,
              color: backgroundColor,
            }}
          >
            {buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

export default CountdownTimerBlock;
