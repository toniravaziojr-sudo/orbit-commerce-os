import { useState, useRef, useEffect } from 'react';
import { Phone, MessageCircle, Mail, MapPin, Clock, ChevronDown, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getWhatsAppHref,
  getPhoneHref,
  getEmailHref,
  isValidWhatsApp,
  isValidPhone,
  isValidEmail
} from '@/lib/contactHelpers';

interface AttendanceDropdownProps {
  phoneNumber?: string;
  whatsAppNumber?: string;
  emailAddress?: string;
  address?: string;
  businessHours?: string;
  headerTextColor?: string;
  headerIconColor?: string;
  isEditing?: boolean;
}

export function HeaderAttendanceDropdown({
  phoneNumber,
  whatsAppNumber,
  emailAddress,
  address,
  businessHours,
  headerTextColor,
  headerIconColor,
  isEditing = false,
}: AttendanceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate contact info - show if valid data exists
  const isPhoneValid = isValidPhone(phoneNumber);
  const isWhatsAppValid = isValidWhatsApp(whatsAppNumber);
  const isEmailValid = isValidEmail(emailAddress);
  const phoneHref = getPhoneHref(phoneNumber);
  const whatsAppHref = getWhatsAppHref(whatsAppNumber);
  const emailHref = getEmailHref(emailAddress);

  // Check if we have any valid contact info to show
  const hasAnyContact = isPhoneValid || isWhatsAppValid || isEmailValid || address || businessHours;
  
  if (!hasAnyContact) {
    return null;
  }

  // Handle hover (desktop)
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  // Handle click (for accessibility and touch devices)
  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) {
      e.preventDefault();
      return;
    }
    setIsOpen(!isOpen);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const iconStyle: React.CSSProperties = {
    color: headerIconColor || headerTextColor || undefined,
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isEditing) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
          "border border-current/20 hover:bg-muted/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
        style={{ color: headerTextColor || undefined }}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Headphones className="h-4 w-4" style={iconStyle} />
        <span>Atendimento</span>
        <ChevronDown 
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
          style={iconStyle}
        />
      </button>

      {/* Dropdown card */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-2 z-50",
            "min-w-[280px] max-w-[320px] p-4",
            "bg-background border rounded-lg shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="space-y-3">
            {/* Phone */}
            {isPhoneValid && phoneHref && (
              <a
                href={phoneHref}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors group"
                onClick={handleLinkClick}
                role="menuitem"
              >
                <div className="mt-0.5 p-1.5 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Compre por telefone</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {phoneNumber}
                  </p>
                </div>
              </a>
            )}

            {/* WhatsApp */}
            {isWhatsAppValid && whatsAppHref && (
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors group"
                onClick={handleLinkClick}
                role="menuitem"
              >
                <div className="mt-0.5 p-1.5 bg-green-50 rounded-md group-hover:bg-green-100 transition-colors">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Fale no WhatsApp</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {whatsAppNumber}
                  </p>
                </div>
              </a>
            )}

            {/* Email */}
            {isEmailValid && emailHref && (
              <a
                href={emailHref}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted transition-colors group"
                onClick={handleLinkClick}
                role="menuitem"
              >
                <div className="mt-0.5 p-1.5 bg-red-50 rounded-md group-hover:bg-red-100 transition-colors">
                  <Mail className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">E-mail</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {emailAddress}
                  </p>
                </div>
              </a>
            )}

            {/* Address */}
            {address && (
              <div className="flex items-start gap-3 p-2">
                <div className="mt-0.5 p-1.5 bg-purple-50 rounded-md">
                  <MapPin className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Endereço</p>
                  <p className="text-sm text-foreground leading-snug">
                    {address}
                  </p>
                </div>
              </div>
            )}

            {/* Business Hours */}
            {businessHours && (
              <div className="flex items-start gap-3 p-2 border-t pt-3">
                <div className="mt-0.5 p-1.5 bg-amber-50 rounded-md">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Horário de atendimento</p>
                  <p className="text-sm text-foreground">
                    {businessHours}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
