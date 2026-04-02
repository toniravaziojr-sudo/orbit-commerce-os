/**
 * import-customers — Canonical motor for customer imports
 * 
 * REFACTORED with Smart Merge + dual mode input.
 * Called by: individual module button AND wizard orchestrator.
 * 
 * Dual mode input:
 *   mode = 'raw_file'         → { csvContent, tenantId }  (individual button, parses CSV internally)
 *   mode = 'normalized_batch' → { jobId, tenantId, items } (wizard, pre-normalized items)
 * 
 * Smart Merge rules:
 *   - New customer → full insert + tag "Cliente" + subscriber + address
 *   - Existing customer → fill null/empty fields ONLY, never overwrite existing data
 *   - Backfill addresses for customers with no addresses
 *   - Always guarantee tag "Cliente" and subscriber record
 * 
 * Output: ImportResponse envelope { success, results: { created, updated, unchanged, skipped, errors, itemErrors } }
 */

import {
  corsResponse,
  jsonResponse,
  createImportResults,
  createImportResponse,
  trackImportedItemsBatch,
  type ImportResults,
  type ImportItemTracking,
} from '../_shared/import-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const VERSION = '2026-04-02.0003';
const CUSTOMER_LOOKUP_PAGE_SIZE = 1000;
const ADDRESS_LOOKUP_BATCH = 500;
const INSERT_BATCH_SIZE = 200;
const MERGE_CONCURRENCY = 10;

// ===========================================
// CSV HEADER MAPPING (for raw_file mode)
// ===========================================

const HEADER_MAP: Record<string, string> = {};

['email', 'e-mail', 'e_mail', 'customer_email', 'email_address', 'correo', 'correo electrónico'].forEach(h => HEADER_MAP[h] = 'email');
['name', 'full_name', 'full name', 'fullname', 'nome', 'nome completo', 'customer_name', 'customer name', 'nombre', 'nombre completo', 'razão social'].forEach(h => HEADER_MAP[h] = 'full_name');
['first_name', 'first name', 'firstname', 'primeiro nome'].forEach(h => { if (!HEADER_MAP[h]) HEADER_MAP[h] = 'first_name'; });
['last_name', 'last name', 'lastname', 'sobrenome', 'último nome', 'apellido'].forEach(h => HEADER_MAP[h] = 'last_name');
['phone', 'telephone', 'telefone', 'celular', 'phone number', 'mobile', 'tel', 'whatsapp', 'default address phone'].forEach(h => HEADER_MAP[h] = 'phone');
['cpf', 'cpf/cnpj', 'cpf_cnpj', 'document', 'documento', 'tax_id', 'tax id', 'identification', 'identificação', 'rut'].forEach(h => HEADER_MAP[h] = 'cpf');
['cnpj'].forEach(h => HEADER_MAP[h] = 'cnpj');
['company', 'company_name', 'empresa', 'razão social', 'default address company'].forEach(h => HEADER_MAP[h] = 'company_name');
['status', 'estado'].forEach(h => HEADER_MAP[h] = 'status');
['accepts email marketing', 'accepts_email_marketing', 'marketing', 'newsletter', 'opt_in', 'aceita email marketing', 'aceita marketing'].forEach(h => HEADER_MAP[h] = 'accepts_marketing');
['total spent', 'total_spent', 'total gasto', 'lifetime_value', 'ltv', 'valor total'].forEach(h => HEADER_MAP[h] = 'total_spent');
['total orders', 'total_orders', 'total pedidos', 'orders_count', 'número de pedidos', 'pedidos'].forEach(h => HEADER_MAP[h] = 'total_orders');
['note', 'notes', 'observações', 'observacao', 'notas', 'tags'].forEach(h => HEADER_MAP[h] = 'notes');
['default address address1', 'address1', 'address', 'endereço', 'rua', 'logradouro', 'street', 'dirección'].forEach(h => HEADER_MAP[h] = 'street');
['default address address2', 'address2', 'complemento', 'complement', 'apt'].forEach(h => HEADER_MAP[h] = 'complement');
['default address city', 'city', 'cidade', 'ciudad'].forEach(h => HEADER_MAP[h] = 'city');
['default address province code', 'state', 'estado', 'uf', 'province', 'provincia', 'região'].forEach(h => HEADER_MAP[h] = 'state');
['default address zip', 'zip', 'postal_code', 'cep', 'zipcode', 'zip code', 'código postal'].forEach(h => HEADER_MAP[h] = 'postal_code');
['default address country code', 'country', 'país', 'pais', 'country_code'].forEach(h => HEADER_MAP[h] = 'country');
['number', 'número', 'numero', 'nro'].forEach(h => HEADER_MAP[h] = 'number');
['neighborhood', 'bairro', 'barrio'].forEach(h => HEADER_MAP[h] = 'neighborhood');
['birth_date', 'birthday', 'data de nascimento', 'data_nascimento', 'aniversário', 'fecha_nacimiento'].forEach(h => HEADER_MAP[h] = 'birth_date');
['gender', 'sexo', 'gênero', 'genero'].forEach(h => HEADER_MAP[h] = 'gender');
['person_type', 'tipo pessoa', 'tipo_pessoa'].forEach(h => HEADER_MAP[h] = 'person_type');
['accepts sms marketing', 'accepts_sms_marketing', 'sms', 'aceita sms'].forEach(h => HEADER_MAP[h] = 'accepts_sms');

// ===========================================
// CSV HELPERS
// ===========================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if ((char === ',' || char === ';') && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function mapHeaders(rawHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const normalized = rawHeaders[i].toLowerCase().trim().replace(/^["']|["']$/g, '');
    const field = HEADER_MAP[normalized];
    if (field) mapping[i] = field;
  }
  return mapping;
}

function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  const rawHeaders = parseCSVLine(lines[0]);
  const headerMapping = mapHeaders(rawHeaders);
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    for (const [idx, field] of Object.entries(headerMapping)) {
      record[field] = values[parseInt(idx)] || '';
    }
    if (!record.full_name && (record.first_name || record.last_name)) {
      record.full_name = `${record.first_name || ''} ${record.last_name || ''}`.trim();
    }
    records.push(record);
  }
  return records;
}

function cleanPhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/['"]/g, '').replace(/[^\d+]/g, '');
  return cleaned || null;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const num = parseFloat(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function parseBooleanYes(value: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return ['yes', 'sim', 'true', '1', 'y', 's'].includes(v);
}

function normalizeEmailValue(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

// ===========================================
// NORMALIZE — Convert CSV record to customer object
// ===========================================

interface NormalizedCustomer {
  email: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company_name: string | null;
  person_type: string | null;
  birth_date: string | null;
  gender: string | null;
  accepts_marketing: boolean;
  accepts_sms: boolean;
  total_spent: number;
  total_orders: number;
  notes: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  external_id?: string;
}

interface ExistingCustomer {
  id: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  company_name: string | null;
  person_type: string | null;
  birth_date: string | null;
  gender: string | null;
  notes: string | null;
  total_spent: number | null;
  total_orders: number | null;
  accepts_marketing: boolean | null;
  accepts_email_marketing: boolean | null;
  accepts_sms_marketing: boolean | null;
}

interface MergePair {
  existing: ExistingCustomer;
  incoming: NormalizedCustomer;
}

function normalizeCSVRecord(rec: Record<string, string>): NormalizedCustomer | null {
  const email = normalizeEmailValue(rec.email);
  if (!email || !email.includes('@')) return null;

  return {
    email,
    full_name: rec.full_name || email.split('@')[0] || 'Cliente',
    phone: cleanPhone(rec.phone || ''),
    cpf: rec.cpf || null,
    cnpj: rec.cnpj || null,
    company_name: rec.company_name || null,
    person_type: rec.person_type || null,
    birth_date: rec.birth_date || null,
    gender: rec.gender || null,
    accepts_marketing: parseBooleanYes(rec.accepts_marketing || 'yes'),
    accepts_sms: parseBooleanYes(rec.accepts_sms || ''),
    total_spent: parseNumber(rec.total_spent || '0'),
    total_orders: parseInt(rec.total_orders || '0') || 0,
    notes: rec.notes || null,
    street: rec.street || null,
    number: rec.number || null,
    complement: rec.complement || null,
    neighborhood: rec.neighborhood || null,
    city: rec.city || null,
    state: rec.state || null,
    postal_code: rec.postal_code?.replace(/['"]/g, '') || null,
    country: rec.country || 'BR',
  };
}

function normalizeWizardItem(item: any): NormalizedCustomer | null {
  const email = normalizeEmailValue((item.email || '').toString());
  if (!email || !email.includes('@')) return null;

  return {
    email,
    full_name: item.full_name || 'Cliente',
    phone: item.phone || null,
    cpf: item.cpf || null,
    cnpj: item.cnpj || null,
    company_name: item.company_name || null,
    person_type: item.person_type || null,
    birth_date: item.birth_date || null,
    gender: item.gender || null,
    accepts_marketing: item.accepts_marketing ?? false,
    accepts_sms: item.accepts_sms ?? false,
    total_spent: item.total_spent || 0,
    total_orders: item.total_orders || 0,
    notes: item.notes || null,
    street: item.addresses?.[0]?.street || item.street || null,
    number: item.addresses?.[0]?.number || item.number || null,
    complement: item.addresses?.[0]?.complement || item.complement || null,
    neighborhood: item.addresses?.[0]?.neighborhood || item.neighborhood || null,
    city: item.addresses?.[0]?.city || item.city || null,
    state: item.addresses?.[0]?.state || item.state || null,
    postal_code: item.addresses?.[0]?.postal_code || item.postal_code || null,
    country: item.addresses?.[0]?.country || item.country || 'BR',
    external_id: item.external_id,
  };
}

function buildCustomerInsertRows(tenantId: string, customers: NormalizedCustomer[]) {
  return customers.map(c => ({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    email: c.email,
    full_name: c.full_name,
    phone: c.phone,
    cpf: c.cpf,
    cnpj: c.cnpj,
    company_name: c.company_name,
    person_type: c.person_type,
    birth_date: c.birth_date,
    gender: c.gender,
    status: 'active',
    accepts_marketing: c.accepts_marketing,
    accepts_email_marketing: c.accepts_marketing,
    accepts_sms_marketing: c.accepts_sms,
    total_orders: c.total_orders,
    total_spent: c.total_spent,
    average_ticket: c.total_orders > 0 ? c.total_spent / c.total_orders : 0,
    notes: c.notes,
  }));
}

async function getExistingCustomersMap(
  supabase: any,
  tenantId: string,
  emails: string[]
): Promise<Map<string, ExistingCustomer>> {
  const normalizedEmails = Array.from(new Set(emails.map(normalizeEmailValue).filter(Boolean)));
  const targetEmailSet = new Set(normalizedEmails);
  const existingMap = new Map<string, ExistingCustomer>();

  if (targetEmailSet.size === 0) return existingMap;

  for (let from = 0; ; from += CUSTOMER_LOOKUP_PAGE_SIZE) {
    const to = from + CUSTOMER_LOOKUP_PAGE_SIZE - 1;
    const { data: batch, error } = await supabase
      .from('customers')
      .select('id, email, phone, cpf, cnpj, company_name, person_type, birth_date, gender, notes, total_spent, total_orders, accepts_marketing, accepts_email_marketing, accepts_sms_marketing')
      .eq('tenant_id', tenantId)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!batch || batch.length === 0) break;

    for (const customer of batch) {
      const normalizedEmail = normalizeEmailValue(customer.email);
      if (normalizedEmail && targetEmailSet.has(normalizedEmail) && !existingMap.has(normalizedEmail)) {
        existingMap.set(normalizedEmail, {
          ...customer,
          email: normalizedEmail,
        });
      }
    }

    if (batch.length < CUSTOMER_LOOKUP_PAGE_SIZE) break;
  }

  return existingMap;
}

async function processMergedCustomers(
  supabase: any,
  customerAddressMap: Map<string, boolean>,
  pairs: MergePair[],
  results: ImportResults,
  trackingItems: ImportItemTracking[],
  startIndex = 0,
) {
  for (let i = 0; i < pairs.length; i += MERGE_CONCURRENCY) {
    const chunk = pairs.slice(i, i + MERGE_CONCURRENCY);
    const mergeResults = await Promise.allSettled(
      chunk.map(async ({ existing, incoming }) => {
        const updates: Record<string, unknown> = {};
        let hasChanges = false;

        if (!existing.phone && incoming.phone) { updates.phone = incoming.phone; hasChanges = true; }
        if (!existing.cpf && incoming.cpf) { updates.cpf = incoming.cpf; hasChanges = true; }
        if (!existing.cnpj && incoming.cnpj) { updates.cnpj = incoming.cnpj; hasChanges = true; }
        if (!existing.company_name && incoming.company_name) { updates.company_name = incoming.company_name; hasChanges = true; }
        if (!existing.person_type && incoming.person_type) { updates.person_type = incoming.person_type; hasChanges = true; }
        if (!existing.birth_date && incoming.birth_date) { updates.birth_date = incoming.birth_date; hasChanges = true; }
        if (!existing.gender && incoming.gender) { updates.gender = incoming.gender; hasChanges = true; }
        if (!existing.notes && incoming.notes) { updates.notes = incoming.notes; hasChanges = true; }
        if ((existing.total_spent === 0 || existing.total_spent === null) && incoming.total_spent > 0) {
          updates.total_spent = incoming.total_spent; hasChanges = true;
        }
        if ((existing.total_orders === 0 || existing.total_orders === null) && incoming.total_orders > 0) {
          updates.total_orders = incoming.total_orders; hasChanges = true;
        }
        if (incoming.accepts_marketing && !existing.accepts_email_marketing) {
          updates.accepts_email_marketing = true; updates.accepts_marketing = true; hasChanges = true;
        }
        if (incoming.accepts_sms && !existing.accepts_sms_marketing) {
          updates.accepts_sms_marketing = true; hasChanges = true;
        }

        if (hasChanges) {
          updates.updated_at = new Date().toISOString();
          await supabase.from('customers').update(updates).eq('id', existing.id);
        }

        if (!customerAddressMap.has(existing.id) && incoming.street && incoming.city) {
          await supabase.from('customer_addresses').insert({
            customer_id: existing.id,
            label: 'Principal',
            is_default: true,
            recipient_name: incoming.full_name,
            street: incoming.street,
            number: incoming.number || '',
            complement: incoming.complement || null,
            neighborhood: incoming.neighborhood || '',
            city: incoming.city,
            state: incoming.state || '',
            postal_code: incoming.postal_code || '',
            country: incoming.country || 'BR',
          });
          customerAddressMap.set(existing.id, true);
        }

        return { id: existing.id, hasChanges, email: incoming.email };
      })
    );

    for (let j = 0; j < chunk.length; j++) {
      const result = mergeResults[j];
      const { existing, incoming } = chunk[j];
      const externalId = incoming.external_id || `import:customer:${incoming.email}`;

      if (result.status === 'fulfilled') {
        if (result.value.hasChanges) {
          results.updated++;
          trackingItems.push({ internalId: existing.id, externalId, result: 'updated' });
        } else {
          results.unchanged++;
          trackingItems.push({ internalId: existing.id, externalId, result: 'unchanged' });
        }
      } else {
        results.errors++;
        results.itemErrors.push({ index: startIndex + i + j, identifier: incoming.email, error: String(result.reason) });
      }
    }
  }
}

async function processInsertedCustomers(
  supabase: any,
  tenantId: string,
  batch: NormalizedCustomer[],
  inserted: Array<{ id: string; email: string }>,
  clienteTagId: string | null,
  clientesListId: string | null,
  trackingItems: ImportItemTracking[],
) {
  if (!inserted.length) return;

  const emailToId = new Map(inserted.map(customer => [normalizeEmailValue(customer.email), customer.id]));

  for (const customer of batch) {
    const customerId = emailToId.get(customer.email);
    if (customerId) {
      const externalId = customer.external_id || `import:customer:${customer.email}`;
      trackingItems.push({ internalId: customerId, externalId, result: 'created' });
    }
  }

  const addresses = batch
    .filter(customer => customer.street && customer.city)
    .map(customer => {
      const customerId = emailToId.get(customer.email);
      if (!customerId) return null;
      return {
        customer_id: customerId,
        label: 'Principal',
        is_default: true,
        recipient_name: customer.full_name,
        street: customer.street || '',
        number: customer.number || '',
        complement: customer.complement || null,
        neighborhood: customer.neighborhood || '',
        city: customer.city || '',
        state: customer.state || '',
        postal_code: customer.postal_code || '',
        country: customer.country || 'BR',
      };
    })
    .filter(Boolean);

  if (addresses.length > 0) {
    await supabase.from('customer_addresses').insert(addresses);
  }

  if (clienteTagId) {
    const tags = inserted.map(customer => ({ customer_id: customer.id, tag_id: clienteTagId }));
    await supabase.from('customer_tag_assignments').upsert(tags, { onConflict: 'customer_id,tag_id', ignoreDuplicates: true });
  }

  const subscribers = inserted.map(customer => {
    const original = batch.find(batchCustomer => batchCustomer.email === normalizeEmailValue(customer.email));
    return {
      tenant_id: tenantId,
      email: normalizeEmailValue(customer.email),
      name: original?.full_name || 'Cliente',
      phone: original?.phone || null,
      source: 'import',
      created_from: 'import',
      status: 'active',
      customer_id: customer.id,
    };
  });

  await supabase
    .from('email_marketing_subscribers')
    .upsert(subscribers, { onConflict: 'tenant_id,email', ignoreDuplicates: true });

  if (clientesListId) {
    const { data: subscribersInDb } = await supabase
      .from('email_marketing_subscribers')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('email', inserted.map(customer => normalizeEmailValue(customer.email)));

    if (subscribersInDb) {
      const listMembers = subscribersInDb.map((subscriber: any) => ({
        tenant_id: tenantId,
        list_id: clientesListId,
        subscriber_id: subscriber.id,
      }));

      await supabase
        .from('email_marketing_list_members')
        .upsert(listMembers, { onConflict: 'list_id,subscriber_id', ignoreDuplicates: true });
    }
  }
}

// ===========================================
// MAIN HANDLER
// ===========================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    
    const mode: 'raw_file' | 'normalized_batch' = body.mode || (body.csvContent ? 'raw_file' : 'normalized_batch');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let tenantId: string;
    let jobId: string | null;
    let normalizedCustomers: NormalizedCustomer[];

    if (mode === 'raw_file') {
      if (!authHeader) {
        return jsonResponse({ success: false, error: 'Missing authorization header' }, 401);
      }
      if (!body.csvContent || !body.tenantId) {
        return jsonResponse({ success: false, error: 'Missing csvContent or tenantId' }, 400);
      }

      const userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
      );
      const { data: userData, error: userError } = await userSupabase.auth.getUser();
      if (userError || !userData.user) {
        return jsonResponse({ success: false, error: 'Invalid user' }, 401);
      }

      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('tenant_id', body.tenantId)
        .maybeSingle();

      if (!roleData || !['owner', 'admin', 'operator'].includes(roleData.role)) {
        return jsonResponse({ success: false, error: 'Permissão insuficiente' }, 403);
      }

      tenantId = body.tenantId;
      jobId = body.jobId || null;

      const parsedRecords = parseCSV(body.csvContent);
      if (parsedRecords.length === 0) {
        return jsonResponse({ success: false, error: 'Nenhum registro válido encontrado no CSV.' }, 400);
      }

      normalizedCustomers = parsedRecords
        .map(normalizeCSVRecord)
        .filter((customer): customer is NormalizedCustomer => customer !== null);

      if (!jobId) {
        const { data: newJob } = await supabaseAdmin
          .from('import_jobs')
          .insert({
            tenant_id: tenantId,
            platform: 'csv',
            status: 'processing',
            modules: ['customers'],
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        jobId = newJob?.id || null;
      }

    } else {
      if (!body.tenantId || !body.jobId || !Array.isArray(body.items)) {
        return jsonResponse({ success: false, error: 'tenantId, jobId e items são obrigatórios para modo normalized_batch' });
      }

      tenantId = body.tenantId;
      jobId = body.jobId;

      normalizedCustomers = body.items
        .map(normalizeWizardItem)
        .filter((customer: NormalizedCustomer | null): customer is NormalizedCustomer => customer !== null);
    }

    if (normalizedCustomers.length === 0) {
      return jsonResponse(createImportResponse(createImportResults(), { version: VERSION, startTime }));
    }

    const results = createImportResults();
    await smartMergeImport(supabaseAdmin, tenantId, jobId!, normalizedCustomers, results);

    if (jobId && mode === 'raw_file') {
      await supabaseAdmin
        .from('import_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          stats: { customers: { created: results.created, updated: results.updated, unchanged: results.unchanged, skipped: results.skipped, errors: results.errors } },
        })
        .eq('id', jobId);
    }

    if (jobId && mode === 'normalized_batch') {
      try {
        await supabaseAdmin.rpc('update_import_job_batch', {
          p_job_id: jobId,
          p_batch_processed: results.created + results.updated + results.unchanged + results.skipped + results.errors,
          p_batch_imported: results.created + results.updated,
          p_batch_failed: results.errors,
          p_batch_skipped: results.skipped + results.unchanged,
          p_errors: results.itemErrors.slice(0, 10),
        });
      } catch (e) {
        console.warn('[import-customers] Could not update job batch:', e);
      }
    }

    return jsonResponse(createImportResponse(results, { version: VERSION, startTime }));
  } catch (err: any) {
    console.error('[import-customers] Fatal error:', err);
    return jsonResponse({
      success: false,
      results: { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 1, itemErrors: [] },
      error: err?.message || String(err),
    }, 500);
  }
});

// ===========================================
// SMART MERGE IMPORT
// ===========================================

async function smartMergeImport(
  supabase: any,
  tenantId: string,
  jobId: string,
  customers: NormalizedCustomer[],
  results: ImportResults
) {
  const emailMap = new Map<string, NormalizedCustomer>();
  for (const customer of customers) {
    if (!emailMap.has(customer.email)) emailMap.set(customer.email, customer);
  }

  const uniqueCustomers = Array.from(emailMap.values());
  const skippedDupes = customers.length - uniqueCustomers.length;
  results.skipped += skippedDupes;

  const emails = uniqueCustomers.map(customer => customer.email);
  const existingMap = await getExistingCustomersMap(supabase, tenantId, emails);

  const existingCustomerIds = Array.from(existingMap.values()).map(customer => customer.id);
  const customerAddressMap = new Map<string, boolean>();

  for (let i = 0; i < existingCustomerIds.length; i += ADDRESS_LOOKUP_BATCH) {
    const idBatch = existingCustomerIds.slice(i, i + ADDRESS_LOOKUP_BATCH);
    const { data: existingAddresses } = await supabase
      .from('customer_addresses')
      .select('customer_id')
      .in('customer_id', idBatch)
      .limit(ADDRESS_LOOKUP_BATCH);

    for (const address of (existingAddresses || [])) {
      customerAddressMap.set(address.customer_id, true);
    }
  }

  let clienteTagId: string | null = null;
  const { data: existingTag } = await supabase
    .from('customer_tags')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Cliente')
    .maybeSingle();

  if (existingTag) {
    clienteTagId = existingTag.id;
  } else {
    const { data: newTag } = await supabase
      .from('customer_tags')
      .insert({ tenant_id: tenantId, name: 'Cliente', color: '#10B981', description: 'Tag automática para clientes' })
      .select('id')
      .single();
    if (newTag) clienteTagId = newTag.id;
  }

  let clientesListId: string | null = null;
  if (clienteTagId) {
    const { data: existingList } = await supabase
      .from('email_marketing_lists')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('tag_id', clienteTagId)
      .maybeSingle();

    if (existingList) {
      clientesListId = existingList.id;
    } else {
      const { data: newList } = await supabase
        .from('email_marketing_lists')
        .insert({ tenant_id: tenantId, name: 'Clientes', description: 'Lista automática de clientes', tag_id: clienteTagId })
        .select('id')
        .single();
      if (newList) clientesListId = newList.id;
    }
  }

  const toInsert: NormalizedCustomer[] = [];
  const toMerge: MergePair[] = [];

  for (const customer of uniqueCustomers) {
    const existing = existingMap.get(customer.email);
    if (existing) {
      toMerge.push({ existing, incoming: customer });
    } else {
      toInsert.push(customer);
    }
  }

  const trackingItems: ImportItemTracking[] = [];
  const allMergedPairs: MergePair[] = [...toMerge];

  await processMergedCustomers(supabase, customerAddressMap, toMerge, results, trackingItems);

  for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
    let pendingBatch = toInsert.slice(i, i + INSERT_BATCH_SIZE);

    for (let attempt = 0; attempt < 2 && pendingBatch.length > 0; attempt++) {
      const insertRows = buildCustomerInsertRows(tenantId, pendingBatch);
      const { data: insertedBatch, error: insertError } = await supabase
        .from('customers')
        .insert(insertRows)
        .select('id, email');

      if (!insertError) {
        const inserted = insertedBatch || [];
        results.created += inserted.length;
        await processInsertedCustomers(supabase, tenantId, pendingBatch, inserted, clienteTagId, clientesListId, trackingItems);
        pendingBatch = [];
        break;
      }

      if (insertError.code === '23505' && attempt === 0) {
        const refreshedExistingMap = await getExistingCustomersMap(
          supabase,
          tenantId,
          pendingBatch.map(customer => customer.email),
        );

        const recoveredMergePairs: MergePair[] = [];
        const retryInsert: NormalizedCustomer[] = [];

        for (const customer of pendingBatch) {
          const existing = refreshedExistingMap.get(customer.email);
          if (existing) {
            recoveredMergePairs.push({ existing, incoming: customer });
          } else {
            retryInsert.push(customer);
          }
        }

        if (recoveredMergePairs.length > 0) {
          allMergedPairs.push(...recoveredMergePairs);
          await processMergedCustomers(supabase, customerAddressMap, recoveredMergePairs, results, trackingItems, i);
        }

        if (retryInsert.length === pendingBatch.length) {
          results.errors += pendingBatch.length;
          results.itemErrors.push({ index: i, identifier: `batch-${i}`, error: insertError.message });
          pendingBatch = [];
          break;
        }

        pendingBatch = retryInsert;
        continue;
      }

      results.errors += pendingBatch.length;
      results.itemErrors.push({ index: i, identifier: `batch-${i}`, error: insertError.message });
      pendingBatch = [];
    }
  }

  if (clienteTagId && allMergedPairs.length > 0) {
    const mergedIds = Array.from(new Set(allMergedPairs.map(pair => pair.existing.id)));

    const { data: existingTags } = await supabase
      .from('customer_tag_assignments')
      .select('customer_id')
      .eq('tag_id', clienteTagId)
      .in('customer_id', mergedIds);

    const taggedIds = new Set((existingTags || []).map((tag: any) => tag.customer_id));
    const missingTags = mergedIds.filter(id => !taggedIds.has(id));

    if (missingTags.length > 0) {
      await supabase.from('customer_tag_assignments').insert(
        missingTags.map(id => ({ customer_id: id, tag_id: clienteTagId }))
      );
    }

    const mergedEmails = Array.from(new Set(allMergedPairs.map(pair => pair.incoming.email)));
    const { data: existingSubscribers } = await supabase
      .from('email_marketing_subscribers')
      .select('email')
      .eq('tenant_id', tenantId)
      .in('email', mergedEmails);

    const subscriberEmails = new Set((existingSubscribers || []).map((subscriber: any) => normalizeEmailValue(subscriber.email)));
    const missingSubscribers = allMergedPairs
      .filter(pair => !subscriberEmails.has(pair.incoming.email))
      .map(pair => ({
        tenant_id: tenantId,
        email: pair.incoming.email,
        name: pair.incoming.full_name,
        phone: pair.incoming.phone,
        source: 'import',
        created_from: 'import',
        status: 'active',
        customer_id: pair.existing.id,
      }));

    if (missingSubscribers.length > 0) {
      await supabase
        .from('email_marketing_subscribers')
        .upsert(missingSubscribers, { onConflict: 'tenant_id,email', ignoreDuplicates: true });
    }
  }

  if (trackingItems.length > 0 && jobId) {
    await trackImportedItemsBatch(supabase, tenantId, jobId, 'customers', trackingItems);
  }

  console.log(`[import-customers v${VERSION}] Complete: created=${results.created}, updated=${results.updated}, unchanged=${results.unchanged}, skipped=${results.skipped}, errors=${results.errors}`);
}
