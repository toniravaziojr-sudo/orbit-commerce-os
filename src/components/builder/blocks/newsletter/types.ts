// =============================================
// NEWSLETTER BLOCK - Unified types
// Merges: Newsletter (inline) + NewsletterForm (form) + PopupModal (popup)
// =============================================

export interface UnifiedNewsletterBlockProps {
  mode?: 'inline' | 'form' | 'popup';
  // Common props
  title?: string;
  subtitle?: string;
  buttonText?: string;
  successMessage?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  isEditing?: boolean;
  context?: any;

  // Inline mode props
  placeholder?: string;
  layout?: string;
  showIcon?: boolean;
  showIncentive?: boolean;
  incentiveText?: string;

  // Form mode props
  listId?: string;
  formSlug?: string;
  privacyText?: string;
  showName?: boolean;
  showPhone?: boolean;
  showBirthDate?: boolean;
  nameRequired?: boolean;
  phoneRequired?: boolean;
  birthDateRequired?: boolean;
  namePlaceholder?: string;
  emailPlaceholder?: string;
  phonePlaceholder?: string;
  borderRadius?: number;
  tenantId?: string;

  // Popup mode props
  type?: string;
  imageUrl?: string;
  imagePosition?: string;
  showEmailInput?: boolean;
  buttonUrl?: string;
  discountCode?: string;
  discountLabel?: string;
  trigger?: string;
  delay?: number;
  scrollPercentage?: number;
  showCloseButton?: boolean;
  closeable?: boolean;
}
