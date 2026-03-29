// =============================================
// SHARED: ProductPackshot
// Reusable product image with ambient glow,
// contact shadow, and hover scale
// =============================================

interface PackshotProps {
  src: string;
  maxW?: string;
  maxH?: string;
  glowColor?: string;
  glowIntensity?: number;
}

export function ProductPackshot({ src, maxW, maxH, glowColor, glowIntensity }: PackshotProps) {
  const gColor = glowColor || 'var(--lp-accent)';
  const gIntensity = glowIntensity ?? 0.08;

  return (
    <div className="relative lp-hero-title-enter flex items-center justify-center" style={{ animationDelay: '0.3s' }}>
      {/* Ambient backlight */}
      <div className="absolute inset-0 scale-90 rounded-full" style={{
        background: `radial-gradient(circle, ${gColor} 0%, transparent 70%)`,
        opacity: gIntensity,
        filter: 'blur(60px)',
      }} />
      {/* Contact shadow */}
      <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-[60%] h-[20px] rounded-full" style={{
        background: 'rgba(0,0,0,0.4)',
        filter: 'blur(15px)',
      }} />
      <img
        src={src}
        alt="Produto"
        className="relative w-full object-contain transition-transform duration-700 hover:scale-105"
        style={{
          filter: `drop-shadow(0 24px 60px var(--lp-shadow))`,
          maxWidth: maxW || 'clamp(260px, 30vw, 400px)',
          maxHeight: maxH || 'clamp(300px, 44vh, 500px)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}