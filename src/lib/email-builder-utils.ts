// =============================================
// EMAIL BUILDER UTILITIES
// Converts email blocks to table-based inline HTML
// =============================================

export interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'product';
  props: Record<string, any>;
}

export type EmailBlockType = EmailBlock['type'];

export const BLOCK_DEFINITIONS: Record<EmailBlockType, { label: string; icon: string; defaultProps: Record<string, any> }> = {
  text: {
    label: 'Texto',
    icon: 'Type',
    defaultProps: { content: 'Escreva seu texto aqui...', tag: 'p', align: 'left', color: '#333333', fontSize: '16' },
  },
  image: {
    label: 'Imagem',
    icon: 'Image',
    defaultProps: { src: '', alt: 'Imagem', width: '100%', link: '' },
  },
  button: {
    label: 'Botão',
    icon: 'MousePointerClick',
    defaultProps: { text: 'Clique Aqui', url: '#', bgColor: '#3b82f6', textColor: '#ffffff', borderRadius: '6', align: 'center', fullWidth: false },
  },
  divider: {
    label: 'Divisor',
    icon: 'Minus',
    defaultProps: { color: '#e5e7eb', thickness: 1, style: 'solid' },
  },
  spacer: {
    label: 'Espaçador',
    icon: 'Space',
    defaultProps: { height: 24 },
  },
  columns: {
    label: 'Colunas',
    icon: 'Columns2',
    defaultProps: { layout: '50-50', columns: [[], []] },
  },
  product: {
    label: 'Produto',
    icon: 'ShoppingBag',
    defaultProps: { product_id: '', showPrice: true, showImage: true, showButton: true, buttonText: 'Comprar' },
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockToHtml(block: EmailBlock): string {
  const { type, props } = block;

  switch (type) {
    case 'text': {
      const tag = props.tag || 'p';
      const style = `font-family:Arial,sans-serif;color:${props.color || '#333333'};font-size:${props.fontSize || '16'}px;text-align:${props.align || 'left'};margin:0;padding:0;line-height:1.5;`;
      return `<${tag} style="${style}">${props.content || ''}</${tag}>`;
    }

    case 'image': {
      const imgStyle = `max-width:${props.width || '100%'};width:${props.width || '100%'};height:auto;display:block;border:0;`;
      const img = `<img src="${escapeHtml(props.src || '')}" alt="${escapeHtml(props.alt || '')}" style="${imgStyle}" />`;
      if (props.link) {
        return `<a href="${escapeHtml(props.link)}" target="_blank" style="text-decoration:none;">${img}</a>`;
      }
      return img;
    }

    case 'button': {
      const btnStyle = `display:${props.fullWidth ? 'block' : 'inline-block'};background-color:${props.bgColor || '#3b82f6'};color:${props.textColor || '#ffffff'};padding:12px 28px;border-radius:${props.borderRadius || '6'}px;text-decoration:none;font-family:Arial,sans-serif;font-size:16px;font-weight:600;text-align:center;${props.fullWidth ? 'width:100%;box-sizing:border-box;' : ''}`;
      const align = props.align || 'center';
      return `<div style="text-align:${align};padding:8px 0;"><a href="${escapeHtml(props.url || '#')}" style="${btnStyle}" target="_blank">${escapeHtml(props.text || 'Clique Aqui')}</a></div>`;
    }

    case 'divider': {
      return `<hr style="border:none;border-top:${props.thickness || 1}px ${props.style || 'solid'} ${props.color || '#e5e7eb'};margin:8px 0;" />`;
    }

    case 'spacer': {
      return `<div style="height:${props.height || 24}px;line-height:${props.height || 24}px;font-size:1px;">&nbsp;</div>`;
    }

    case 'columns': {
      const cols: EmailBlock[][] = props.columns || [[], []];
      const widths = (props.layout || '50-50').split('-').map((w: string) => `${w}%`);
      const tds = cols.map((colBlocks: EmailBlock[], i: number) => {
        const inner = colBlocks.map(blockToHtml).join('');
        return `<td style="width:${widths[i] || '50%'};vertical-align:top;padding:0 8px;">${inner}</td>`;
      }).join('');
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;"><tr>${tds}</tr></table>`;
    }

    case 'product': {
      // Placeholder - real product data would be injected server-side
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;font-family:Arial,sans-serif;">
        ${props.showImage ? '<div style="background:#f3f4f6;height:150px;border-radius:4px;margin-bottom:12px;display:flex;align-items:center;justify-content:center;color:#9ca3af;">Imagem do Produto</div>' : ''}
        <p style="font-weight:600;margin:0 0 8px;font-size:16px;color:#111827;">Nome do Produto</p>
        ${props.showPrice ? '<p style="color:#3b82f6;font-weight:700;margin:0 0 12px;font-size:18px;">R$ 99,90</p>' : ''}
        ${props.showButton ? `<a href="#" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">${escapeHtml(props.buttonText || 'Comprar')}</a>` : ''}
      </div>`;
    }

    default:
      return '';
  }
}

export function blocksToHtml(blocks: EmailBlock[], previewText?: string): string {
  const bodyContent = blocks.map(b => {
    const html = blockToHtml(b);
    return `<tr><td style="padding:8px 0;">${html}</td></tr>`;
  }).join('\n');

  const previewSpan = previewText
    ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(previewText)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  ${previewSpan}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          ${bodyContent}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function blocksToPlainText(blocks: EmailBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'text':
        return (b.props.content || '').replace(/<[^>]*>/g, '');
      case 'button':
        return `${b.props.text || ''} → ${b.props.url || ''}`;
      case 'divider':
        return '---';
      case 'spacer':
        return '';
      case 'product':
        return `[Produto] ${b.props.buttonText || 'Ver'}`;
      default:
        return '';
    }
  }).filter(Boolean).join('\n\n');
}

export function createBlock(type: EmailBlockType): EmailBlock {
  const def = BLOCK_DEFINITIONS[type];
  return {
    id: crypto.randomUUID(),
    type,
    props: { ...def.defaultProps },
  };
}
