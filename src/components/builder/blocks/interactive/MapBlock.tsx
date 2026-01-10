// =============================================
// MAP BLOCK - Google Maps embed
// =============================================

import React from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MapBlockProps {
  title?: string;
  subtitle?: string;
  // Map configuration
  address?: string;
  embedUrl?: string;
  latitude?: string;
  longitude?: string;
  zoom?: number;
  // Display options
  height?: 'sm' | 'md' | 'lg' | 'xl';
  showAddress?: boolean;
  showDirectionsButton?: boolean;
  directionsButtonText?: string;
  layout?: 'full' | 'with-info' | 'side-by-side';
  // Contact info for side layouts
  showContactInfo?: boolean;
  contactTitle?: string;
  contactAddress?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactHours?: string;
  // Styling
  rounded?: boolean;
  shadow?: boolean;
  backgroundColor?: string;
  isEditing?: boolean;
}

export function MapBlock({
  title,
  subtitle,
  address = 'Av. Paulista, 1000 - São Paulo, SP',
  embedUrl,
  latitude,
  longitude,
  zoom = 15,
  height = 'md',
  showAddress = true,
  showDirectionsButton = true,
  directionsButtonText = 'Como Chegar',
  layout = 'full',
  showContactInfo = true,
  contactTitle = 'Nosso Endereço',
  contactAddress = 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100',
  contactPhone = '(11) 99999-9999',
  contactEmail = 'contato@sualoja.com',
  contactHours = 'Seg - Sex: 9h às 18h | Sáb: 9h às 13h',
  rounded = true,
  shadow = true,
  backgroundColor,
  isEditing,
}: MapBlockProps) {
  const heightClasses = {
    sm: 'h-48',
    md: 'h-64',
    lg: 'h-96',
    xl: 'h-[500px]',
  };

  // Generate Google Maps embed URL
  const getMapUrl = () => {
    if (embedUrl) return embedUrl;
    
    const encodedAddress = encodeURIComponent(address);
    
    if (latitude && longitude) {
      return `https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${latitude},${longitude}&zoom=${zoom}`;
    }
    
    // Use place embed without API key (limited but works for basic use)
    return `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  };

  const getDirectionsUrl = () => {
    const encodedAddress = encodeURIComponent(address);
    if (latitude && longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: backgroundColor || undefined,
  };

  const MapEmbed = () => (
    <div className={cn(
      "relative overflow-hidden bg-muted",
      heightClasses[height],
      rounded && "rounded-xl",
      shadow && "shadow-lg"
    )}>
      {isEditing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
          <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center px-4">
            Prévia do mapa: {address}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            [O mapa será exibido na visualização final]
          </p>
        </div>
      ) : (
        <iframe
          src={getMapUrl()}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Localização no mapa"
          className="absolute inset-0"
        />
      )}
    </div>
  );

  const ContactInfo = () => (
    <div className="space-y-4">
      {contactTitle && <h3 className="text-xl font-semibold">{contactTitle}</h3>}
      
      {contactAddress && (
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">{contactAddress}</p>
        </div>
      )}

      {contactPhone && (
        <div className="flex items-center gap-3">
          <Navigation className="w-5 h-5 text-primary shrink-0" />
          <a 
            href={`tel:${contactPhone.replace(/\D/g, '')}`}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {contactPhone}
          </a>
        </div>
      )}

      {contactEmail && (
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <a 
            href={`mailto:${contactEmail}`}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {contactEmail}
          </a>
        </div>
      )}

      {contactHours && (
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-muted-foreground">{contactHours}</p>
        </div>
      )}

      {showDirectionsButton && (
        <Button 
          asChild 
          className="mt-4"
          variant="outline"
        >
          <a 
            href={getDirectionsUrl()} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Navigation className="w-4 h-4 mr-2" />
            {directionsButtonText}
            <ExternalLink className="w-3 h-3 ml-2" />
          </a>
        </Button>
      )}
    </div>
  );

  // Full width layout
  if (layout === 'full') {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-6xl mx-auto">
          {title && <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>}
          {subtitle && <p className="text-muted-foreground mb-8 text-center">{subtitle}</p>}
          
          <MapEmbed />

          {(showAddress || showDirectionsButton) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              {showAddress && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span>{address}</span>
                </div>
              )}
              {showDirectionsButton && (
                <Button asChild variant="outline">
                  <a 
                    href={getDirectionsUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    {directionsButtonText}
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Side by side layout
  if (layout === 'side-by-side') {
    return (
      <div className="py-12 px-4" style={containerStyle}>
        <div className="max-w-6xl mx-auto">
          {title && <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>}
          {subtitle && <p className="text-muted-foreground mb-8 text-center">{subtitle}</p>}

          <div className="grid md:grid-cols-2 gap-8 items-center">
            {showContactInfo && <ContactInfo />}
            <MapEmbed />
          </div>
        </div>
      </div>
    );
  }

  // With info layout (info below map)
  return (
    <div className="py-12 px-4" style={containerStyle}>
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-2xl font-bold mb-2 text-center">{title}</h2>}
        {subtitle && <p className="text-muted-foreground mb-8 text-center">{subtitle}</p>}

        <MapEmbed />

        {showContactInfo && (
          <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {contactAddress && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Endereço</p>
                  <p className="text-sm text-muted-foreground">{contactAddress}</p>
                </div>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Navigation className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Telefone</p>
                  <p className="text-sm text-muted-foreground">{contactPhone}</p>
                </div>
              </div>
            )}
            {contactEmail && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="font-medium">E-mail</p>
                  <p className="text-sm text-muted-foreground">{contactEmail}</p>
                </div>
              </div>
            )}
            {contactHours && (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium">Horário</p>
                  <p className="text-sm text-muted-foreground">{contactHours}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {showDirectionsButton && (
          <div className="flex justify-center mt-6">
            <Button asChild>
              <a 
                href={getDirectionsUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {directionsButtonText}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
