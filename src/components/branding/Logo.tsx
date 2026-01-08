import { cn } from "@/lib/utils";

interface LogoIconProps {
  className?: string;
  size?: number;
}

interface LogoFullProps {
  className?: string;
  iconSize?: number;
  textClassName?: string;
  layout?: "vertical" | "horizontal";
}

/**
 * Ícone do logo Comando Central (seta/foguete em gradiente azul-roxo)
 * Componente SVG vetorizado para escalar perfeitamente
 */
export function LogoIcon({ className, size = 40 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
      </defs>
      {/* Quadrado arredondado de fundo */}
      <rect
        x="8"
        y="8"
        width="60"
        height="60"
        rx="16"
        fill="url(#logoGradient)"
      />
      {/* Seta diagonal para cima-direita */}
      <path
        d="M30 55 L55 30 M55 30 L55 45 M55 30 L40 30"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Extensão da seta curvando para fora do quadrado */}
      <path
        d="M55 30 Q75 10 90 25 Q95 30 90 45 L75 60"
        stroke="url(#logoGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Ponta da seta externa */}
      <path
        d="M82 18 L92 28 L82 38"
        stroke="url(#logoGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Logo completo com ícone e texto "Comando Central"
 * Pode ser vertical ou horizontal
 */
export function LogoFull({ 
  className, 
  iconSize = 48, 
  textClassName,
  layout = "vertical" 
}: LogoFullProps) {
  const isHorizontal = layout === "horizontal";
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3",
        isHorizontal ? "flex-row" : "flex-col",
        className
      )}
    >
      <LogoIcon size={iconSize} />
      <div className={cn(
        "font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 bg-clip-text text-transparent",
        isHorizontal ? "text-xl leading-tight" : "text-center",
        textClassName
      )}>
        <span className={isHorizontal ? "" : "block"}>Comando</span>
        {!isHorizontal && " "}
        <span className={isHorizontal ? "block" : ""}>Central</span>
      </div>
    </div>
  );
}

/**
 * Logo horizontal compacto para headers
 */
export function LogoHorizontal({ className, iconSize = 36 }: { className?: string; iconSize?: number }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoIcon size={iconSize} />
      <span className="font-bold text-lg bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
        Comando Central
      </span>
    </div>
  );
}

export default LogoFull;
