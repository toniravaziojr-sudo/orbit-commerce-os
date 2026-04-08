// =============================================
// CONTENT SECTION BLOCK - Unified (ContentColumns + TextBanners)
// style: 'content' = image + text + features (ex-ContentColumns)
// style: 'editorial' = text + 2 images (ex-TextBanners)
// =============================================

import React from 'react';
import { ContentColumnsBlock } from '../ContentColumnsBlock';
import { TextBannersBlock } from '../TextBannersBlock';
import type { ContentSectionBlockProps } from './types';

export function ContentSectionBlock({
  style = 'content',
  title,
  subtitle,
  // Content mode props
  content,
  imageDesktop,
  imageMobile,
  imagePosition = 'left',
  features,
  iconColor,
  showButton,
  buttonText,
  buttonUrl,
  backgroundColor,
  textColor,
  // Editorial mode props
  text,
  imageDesktop1,
  imageMobile1,
  imageDesktop2,
  imageMobile2,
  ctaEnabled = true,
  ctaText,
  ctaUrl,
  ctaBgColor,
  ctaTextColor,
  layout = 'text-left',
  context,
}: ContentSectionBlockProps) {
  if (style === 'editorial') {
    return (
      <TextBannersBlock
        title={title}
        text={text || subtitle}
        imageDesktop1={imageDesktop1}
        imageMobile1={imageMobile1}
        imageDesktop2={imageDesktop2}
        imageMobile2={imageMobile2}
        ctaEnabled={ctaEnabled}
        ctaText={ctaText}
        ctaUrl={ctaUrl}
        ctaBgColor={ctaBgColor}
        ctaTextColor={ctaTextColor}
        layout={layout === 'text-left' || layout === 'left' ? 'text-left' : 'text-right'}
        context={context}
      />
    );
  }

  // Content mode (default)
  return (
    <ContentColumnsBlock
      title={title}
      subtitle={subtitle}
      content={content}
      imageDesktop={imageDesktop}
      imageMobile={imageMobile}
      imagePosition={imagePosition === 'left' || imagePosition === 'right' ? imagePosition : 'left'}
      features={features}
      iconColor={iconColor}
      showButton={showButton}
      buttonText={buttonText}
      buttonUrl={buttonUrl}
      backgroundColor={backgroundColor}
      textColor={textColor}
      context={context}
    />
  );
}
