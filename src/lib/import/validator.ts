// =============================================
// VALIDADOR DE DADOS DE IMPORTAÇÃO
// Valida dados antes de inserir no banco
// =============================================

import { z } from 'zod';
import type {
  NormalizedProduct,
  NormalizedCategory,
  NormalizedCustomer,
  NormalizedOrder,
  ImportError,
  ImportWarning,
} from './types';

// Schemas de validação
const productImageSchema = z.object({
  url: z.string().url('URL da imagem inválida'),
  alt: z.string().max(255).nullable(),
  is_primary: z.boolean(),
  position: z.number().min(0),
});

const productVariantSchema = z.object({
  name: z.string().min(1, 'Nome da variante é obrigatório'),
  sku: z.string().max(100).nullable(),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  compare_at_price: z.number().min(0).nullable(),
  stock_quantity: z.number().int().nullable(),
  options: z.record(z.string()),
});

const productSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório').max(255, 'Nome muito longo'),
  slug: z.string().min(1, 'Slug é obrigatório').max(255).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  description: z.string().max(50000).nullable(),
  short_description: z.string().max(1000).nullable(),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  compare_at_price: z.number().min(0).nullable(),
  cost_price: z.number().min(0).nullable(),
  sku: z.string().max(100).nullable(),
  barcode: z.string().max(100).nullable(),
  weight: z.number().min(0).nullable(),
  width: z.number().min(0).nullable(),
  height: z.number().min(0).nullable(),
  depth: z.number().min(0).nullable(),
  stock_quantity: z.number().int().nullable(),
  is_featured: z.boolean(),
  status: z.enum(['active', 'draft', 'archived']),
  seo_title: z.string().max(70).nullable(),
  seo_description: z.string().max(160).nullable(),
  images: z.array(productImageSchema),
  variants: z.array(productVariantSchema),
  categories: z.array(z.string()),
});

const categorySchema = z.object({
  name: z.string().min(1, 'Nome da categoria é obrigatório').max(255),
  slug: z.string().min(1, 'Slug é obrigatório').max(255).regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  description: z.string().max(5000).nullable(),
  image_url: z.string().url().nullable().or(z.literal('')),
  banner_desktop_url: z.string().url().nullable().or(z.literal('')),
  banner_mobile_url: z.string().url().nullable().or(z.literal('')),
  parent_slug: z.string().max(255).nullable(),
  seo_title: z.string().max(70).nullable(),
  seo_description: z.string().max(160).nullable(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
});

const addressSchema = z.object({
  label: z.string().max(50),
  recipient_name: z.string().min(1).max(255),
  street: z.string().max(255),
  number: z.string().max(20),
  complement: z.string().max(255).nullable(),
  neighborhood: z.string().max(255),
  city: z.string().max(255),
  state: z.string().max(2),
  postal_code: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'),
  country: z.string().max(2),
  is_default: z.boolean(),
});

const customerSchema = z.object({
  email: z.string().email('E-mail inválido').max(255),
  full_name: z.string().min(1, 'Nome é obrigatório').max(255),
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido').nullable().or(z.literal('')),
  cpf: z.string().regex(/^\d{11}$/, 'CPF inválido').nullable().or(z.literal('')),
  birth_date: z.string().nullable(),
  gender: z.string().max(20).nullable(),
  accepts_marketing: z.boolean(),
  status: z.enum(['active', 'inactive']),
  addresses: z.array(addressSchema),
  tags: z.array(z.string()),
  notes: z.string().max(5000).nullable(),
});

const orderItemSchema = z.object({
  product_name: z.string().min(1).max(255),
  product_sku: z.string().max(100).nullable(),
  variant_name: z.string().max(255).nullable(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  total_price: z.number().min(0),
});

const orderSchema = z.object({
  order_number: z.string().min(1).max(50),
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded']),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'cancelled']),
  payment_method: z.string().max(100).nullable(),
  shipping_status: z.string().max(50).nullable(),
  subtotal: z.number().min(0),
  discount_total: z.number().min(0),
  shipping_total: z.number().min(0),
  total: z.number().min(0),
  currency: z.string().length(3),
  customer_email: z.string().email(),
  customer_name: z.string().max(255),
  customer_phone: z.string().max(20).nullable(),
  shipping_address: addressSchema.nullable(),
  billing_address: addressSchema.nullable(),
  items: z.array(orderItemSchema).min(1, 'Pedido deve ter ao menos um item'),
  notes: z.string().max(5000).nullable(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  shipped_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  tracking_code: z.string().max(100).nullable(),
  tracking_carrier: z.string().max(100).nullable(),
});

// Resultados de validação
export interface ValidationResult<T> {
  valid: boolean;
  data: T | null;
  errors: ImportError[];
  warnings: ImportWarning[];
}

// Funções de validação
export function validateProduct(product: NormalizedProduct, row?: number): ValidationResult<NormalizedProduct> {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  
  // Validar com Zod
  const result = productSchema.safeParse(product);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
        originalValue: getNestedValue(product, issue.path),
        row,
      });
    }
  }
  
  // Validações adicionais e warnings
  if (product.price === 0) {
    warnings.push({
      field: 'price',
      message: 'Produto com preço zero',
      suggestion: 'Verifique se o preço está correto ou se é um produto gratuito',
    });
  }
  
  if (product.images.length === 0) {
    warnings.push({
      field: 'images',
      message: 'Produto sem imagens',
      suggestion: 'Adicione pelo menos uma imagem ao produto',
    });
  }
  
  if (product.compare_at_price && product.compare_at_price <= product.price) {
    warnings.push({
      field: 'compare_at_price',
      message: 'Preço promocional maior ou igual ao preço normal',
      suggestion: 'O preço "De" deve ser maior que o preço "Por"',
    });
  }
  
  if (!product.seo_title) {
    warnings.push({
      field: 'seo_title',
      message: 'Título SEO não definido',
      suggestion: 'Será usado o nome do produto como título SEO',
    });
  }
  
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (result.success ? result.data as NormalizedProduct : product) : null,
    errors,
    warnings,
  };
}

export function validateCategory(category: NormalizedCategory, row?: number): ValidationResult<NormalizedCategory> {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  
  const result = categorySchema.safeParse(category);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
        originalValue: getNestedValue(category, issue.path),
        row,
      });
    }
  }
  
  if (!category.image_url) {
    warnings.push({
      field: 'image_url',
      message: 'Categoria sem imagem',
      suggestion: 'Adicione uma imagem para melhor apresentação',
    });
  }
  
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (result.success ? result.data as NormalizedCategory : category) : null,
    errors,
    warnings,
  };
}

export function validateCustomer(customer: NormalizedCustomer, row?: number): ValidationResult<NormalizedCustomer> {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  
  // Ajustar campos opcionais vazios
  const adjusted = {
    ...customer,
    phone: customer.phone || null,
    cpf: customer.cpf || null,
  };
  
  const result = customerSchema.safeParse(adjusted);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
        originalValue: getNestedValue(customer, issue.path),
        row,
      });
    }
  }
  
  if (!customer.phone) {
    warnings.push({
      field: 'phone',
      message: 'Cliente sem telefone',
      suggestion: 'Telefone é útil para contato e notificações',
    });
  }
  
  if (customer.addresses.length === 0) {
    warnings.push({
      field: 'addresses',
      message: 'Cliente sem endereço cadastrado',
      suggestion: 'Endereço será solicitado na primeira compra',
    });
  }
  
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (result.success ? result.data as NormalizedCustomer : adjusted) : null,
    errors,
    warnings,
  };
}

export function validateOrder(order: NormalizedOrder, row?: number): ValidationResult<NormalizedOrder> {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  
  const result = orderSchema.safeParse(order);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
        originalValue: getNestedValue(order, issue.path),
        row,
      });
    }
  }
  
  // Validar totais
  const calculatedSubtotal = order.items.reduce((sum, item) => sum + item.total_price, 0);
  const calculatedTotal = calculatedSubtotal - order.discount_total + order.shipping_total;
  
  if (Math.abs(calculatedSubtotal - order.subtotal) > 0.01) {
    warnings.push({
      field: 'subtotal',
      message: `Subtotal não confere (esperado: ${calculatedSubtotal.toFixed(2)}, recebido: ${order.subtotal.toFixed(2)})`,
      suggestion: 'Verifique os preços dos itens',
    });
  }
  
  if (Math.abs(calculatedTotal - order.total) > 0.01) {
    warnings.push({
      field: 'total',
      message: `Total não confere (esperado: ${calculatedTotal.toFixed(2)}, recebido: ${order.total.toFixed(2)})`,
      suggestion: 'Verifique subtotal, desconto e frete',
    });
  }
  
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (result.success ? result.data as NormalizedOrder : order) : null,
    errors,
    warnings,
  };
}

// Validação em lote
export function validateBatch<T>(
  items: T[],
  validator: (item: T, row?: number) => ValidationResult<T>
): {
  valid: T[];
  invalid: { item: T; errors: ImportError[] }[];
  allWarnings: ImportWarning[];
  stats: { total: number; valid: number; invalid: number };
} {
  const valid: T[] = [];
  const invalid: { item: T; errors: ImportError[] }[] = [];
  const allWarnings: ImportWarning[] = [];
  
  items.forEach((item, index) => {
    const result = validator(item, index + 1);
    
    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ item, errors: result.errors });
    }
    
    allWarnings.push(...result.warnings);
  });
  
  return {
    valid,
    invalid,
    allWarnings,
    stats: {
      total: items.length,
      valid: valid.length,
      invalid: invalid.length,
    },
  };
}

// Helper para acessar valores aninhados
function getNestedValue(obj: any, path: (string | number)[]): any {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

// Utilitários de sanitização
export function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 255);
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function sanitizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function sanitizeCep(cep: string): string {
  return cep.replace(/\D/g, '').padStart(8, '0');
}
