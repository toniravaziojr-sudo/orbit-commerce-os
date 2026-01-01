// =====================================================
// ELEMENT CLASSIFIER v1
// =====================================================
// Classifies extracted elements into native block types
// Determines confidence level and whether new block is needed
// =====================================================

import type { ExtractedElement, ElementType } from './element-extractor.ts';

export interface ClassifiedElement extends ExtractedElement {
  blockType: string;
  blockProps: Record<string, unknown>;
  confidence: number; // 0-1
  needsNewBlock: boolean;
  suggestedBlockName?: string;
}

// =====================================================
// VIDEO CLASSIFICATION
// =====================================================
function classifyVideo(element: ExtractedElement): ClassifiedElement {
  const { videoId, videoSource, videoUrl } = element.metadata;
  
  if (videoSource === 'youtube' && videoId) {
    return {
      ...element,
      blockType: 'YouTubeVideo',
      blockProps: {
        youtubeUrl: videoUrl || `https://www.youtube.com/watch?v=${videoId}`,
        videoId: videoId,
        title: '',
        showControls: true,
      },
      confidence: 1.0,
      needsNewBlock: false,
    };
  }
  
  if (videoSource === 'vimeo' && videoId) {
    return {
      ...element,
      blockType: 'YouTubeVideo', // We use same block for Vimeo
      blockProps: {
        youtubeUrl: `https://vimeo.com/${videoId}`,
        videoId: videoId,
        title: '',
        showControls: true,
      },
      confidence: 0.9,
      needsNewBlock: false,
    };
  }
  
  // Unknown video source - use CustomBlock
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'Vídeo Importado',
    },
    confidence: 0.5,
    needsNewBlock: false,
  };
}

// =====================================================
// VIDEO CAROUSEL CLASSIFICATION
// =====================================================
function classifyVideoCarousel(element: ExtractedElement): ClassifiedElement {
  const { videos } = element.metadata;
  
  if (videos && videos.length >= 2) {
    // Convert to VideoCarousel block format
    const videosJson = videos.map(v => v.url).join('\n');
    
    return {
      ...element,
      blockType: 'VideoCarousel',
      blockProps: {
        videosJson: videosJson,
        showControls: true,
        autoplay: false,
        slidesPerView: Math.min(3, videos.length),
        gap: 16,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  }
  
  // Fallback
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'Carrossel de Vídeos',
    },
    confidence: 0.5,
    needsNewBlock: true,
    suggestedBlockName: 'VideoCarousel',
  };
}

// =====================================================
// IMAGE CLASSIFICATION
// =====================================================
function classifyImage(element: ExtractedElement): ClassifiedElement {
  const { imageDesktop, imageMobile, imageAlt } = element.metadata;
  
  if (imageDesktop) {
    return {
      ...element,
      blockType: 'Image',
      blockProps: {
        imageDesktop: imageDesktop,
        imageMobile: imageMobile || imageDesktop,
        alt: imageAlt || '',
        linkUrl: '',
        objectFit: 'contain',
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  }
  
  // Fallback
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'Imagem',
    },
    confidence: 0.4,
    needsNewBlock: false,
  };
}

// =====================================================
// HEADING CLASSIFICATION
// =====================================================
function classifyHeading(element: ExtractedElement): ClassifiedElement {
  const { level, text, content, styles } = element.metadata;
  
  // Build HTML with preserved styling
  let htmlContent = `<${level}`;
  
  if (styles && Object.keys(styles).length > 0) {
    const styleStr = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');
    htmlContent += ` style="${styleStr}"`;
  }
  
  htmlContent += `>${content || text}</${level}>`;
  
  return {
    ...element,
    blockType: 'RichText',
    blockProps: {
      content: htmlContent,
      fontFamily: styles?.fontFamily || 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    confidence: 0.95,
    needsNewBlock: false,
  };
}

// =====================================================
// BUTTON CLASSIFICATION
// =====================================================
function classifyButton(element: ExtractedElement): ClassifiedElement {
  const { buttonText, buttonUrl, buttonVariant } = element.metadata;
  
  if (buttonText && buttonText.length >= 2) {
    return {
      ...element,
      blockType: 'Button',
      blockProps: {
        text: buttonText,
        url: buttonUrl || '#',
        variant: buttonVariant || 'primary',
        size: 'lg',
        fullWidth: false,
        alignment: 'center',
      },
      confidence: 0.9,
      needsNewBlock: false,
    };
  }
  
  // Fallback
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'Botão',
    },
    confidence: 0.4,
    needsNewBlock: false,
  };
}

// =====================================================
// TEXT CLASSIFICATION
// =====================================================
function classifyText(element: ExtractedElement): ClassifiedElement {
  const { text, content } = element.metadata;
  
  return {
    ...element,
    blockType: 'RichText',
    blockProps: {
      content: content || `<p>${text}</p>`,
      fontFamily: 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    confidence: 0.85,
    needsNewBlock: false,
  };
}

// =====================================================
// FAQ CLASSIFICATION
// =====================================================
function classifyFAQ(element: ExtractedElement): ClassifiedElement {
  const { faqItems, faqTitle } = element.metadata;
  
  if (faqItems && faqItems.length >= 2) {
    return {
      ...element,
      blockType: 'FAQ',
      blockProps: {
        title: faqTitle || 'Perguntas Frequentes',
        titleAlign: 'left',
        items: faqItems,
        allowMultiple: false,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  }
  
  // Fallback if too few items
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'FAQ',
    },
    confidence: 0.5,
    needsNewBlock: false,
  };
}

// =====================================================
// TESTIMONIAL CLASSIFICATION
// =====================================================
function classifyTestimonial(element: ExtractedElement): ClassifiedElement {
  const { testimonialItems, testimonialTitle } = element.metadata;
  
  if (testimonialItems && testimonialItems.length >= 2) {
    return {
      ...element,
      blockType: 'Testimonials',
      blockProps: {
        title: testimonialTitle || 'Depoimentos',
        items: testimonialItems,
      },
      confidence: 0.95,
      needsNewBlock: false,
    };
  }
  
  // Fallback
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: 'Depoimentos',
    },
    confidence: 0.5,
    needsNewBlock: false,
  };
}

// =====================================================
// UNKNOWN/FALLBACK CLASSIFICATION
// =====================================================
function classifyUnknown(element: ExtractedElement): ClassifiedElement {
  return {
    ...element,
    blockType: 'CustomBlock',
    blockProps: {
      htmlContent: element.rawHtml,
      blockName: `Seção ${element.type}`,
    },
    confidence: 0.3,
    needsNewBlock: true,
    suggestedBlockName: element.type,
  };
}

// =====================================================
// MAIN CLASSIFICATION FUNCTION
// =====================================================
export function classifyElement(element: ExtractedElement): ClassifiedElement {
  switch (element.type) {
    case 'video':
      return classifyVideo(element);
    case 'video-carousel':
      return classifyVideoCarousel(element);
    case 'image':
      return classifyImage(element);
    case 'image-carousel':
      return classifyImage(element); // Use same as image for now
    case 'heading':
      return classifyHeading(element);
    case 'button':
      return classifyButton(element);
    case 'text':
      return classifyText(element);
    case 'faq':
      return classifyFAQ(element);
    case 'testimonial':
      return classifyTestimonial(element);
    default:
      return classifyUnknown(element);
  }
}

// Classify all elements
export function classifyAllElements(elements: ExtractedElement[]): ClassifiedElement[] {
  console.log(`[CLASSIFY] Classifying ${elements.length} elements`);
  
  const classified = elements.map(element => {
    const result = classifyElement(element);
    console.log(`[CLASSIFY] ${element.type} @ ${element.position} -> ${result.blockType} (conf: ${(result.confidence * 100).toFixed(0)}%)`);
    return result;
  });
  
  // Log summary
  const blockTypes = classified.map(c => c.blockType);
  const typeCounts = blockTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`[CLASSIFY] Summary:`, typeCounts);
  
  const needsNew = classified.filter(c => c.needsNewBlock);
  if (needsNew.length > 0) {
    console.log(`[CLASSIFY] Needs new blocks: ${needsNew.map(c => c.suggestedBlockName).join(', ')}`);
  }
  
  return classified;
}
