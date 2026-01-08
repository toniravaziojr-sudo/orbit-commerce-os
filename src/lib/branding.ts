/**
 * Comando Central - Configuração de Branding Centralizada
 * 
 * Esta é a fonte única de verdade para todo branding da plataforma.
 * NÃO DUPLIQUE estas informações em outros lugares do código.
 */

import logoFull from "@/assets/logo-full.png";
import logoIcon from "@/assets/logo-icon.png";
import logoHorizontal from "@/assets/logo-horizontal.png";

export const platformBranding = {
  // Nome do produto
  productName: "Comando Central",
  
  // Slogan oficial
  slogan: "O centro de comando do seu e-commerce.",
  
  // Tagline curta (para uso em espaços menores)
  tagline: "Plataforma E-commerce",
  
  // Assets de logo
  logos: {
    // Logo completa vertical com texto e slogan (para login, confirmação, etc.)
    full: logoFull,
    
    // Apenas o ícone/símbolo (para sidebar colapsada, favicon, etc.)
    icon: logoIcon,
    
    // Logo horizontal com texto (para headers, etc.)
    horizontal: logoHorizontal,
  },
  
  // URLs públicas para uso em emails e contextos externos
  publicUrls: {
    logo: "https://app.comandocentral.com.br/images/email-logo.png",
    website: "https://comandocentral.com.br",
    app: "https://app.comandocentral.com.br",
  },
  
  // Cores principais da marca (para referência)
  colors: {
    primary: "#6366F1", // Azul-índigo (base do gradiente)
    secondary: "#A855F7", // Roxo (final do gradiente)
    gradient: "linear-gradient(135deg, #3B82F6 0%, #9333EA 100%)",
    dark: "#0F172A", // Fundo escuro
  },
  
  // Informações de contato/suporte
  support: {
    email: "suporte@comandocentral.com.br",
  },
  
  // Copyright
  copyright: `© ${new Date().getFullYear()} Comando Central. Todos os direitos reservados.`,
} as const;

// Tipos para TypeScript
export type PlatformBranding = typeof platformBranding;
