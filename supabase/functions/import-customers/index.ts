import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================
// UNIVERSAL CSV HEADER MAPPING
// Maps common headers from Shopify, WooCommerce, Nuvemshop, Tray, and generic CSVs
// =============================================

const HEADER_MAP: Record<string, string> = {};

// Email mappings
['email', 'e-mail', 'e_mail', 'customer_email', 'email_address', 'correo', 'correo electrónico'].forEach(h => HEADER_MAP[h] = 'email');

// Name mappings (full name)
['name', 'full_name', 'full name', 'fullname', 'nome', 'nome completo', 'customer_name', 'customer name', 'nombre', 'nombre completo', 'razão social'].forEach(h => HEADER_MAP[h] = 'full_name');

// First name
['first_name', 'first name', 'firstname', 'primeiro nome', 'nome'].forEach(h => {
  if (!HEADER_MAP[h]) HEADER_MAP[h] = 'first_name';
});

// Last name
['last_name', 'last name', 'lastname', 'sobrenome', 'último nome', 'apellido'].forEach(h => HEADER_MAP[h] = 'last_name');

// Phone
['phone', 'telephone', 'telefone', 'celular', 'phone number', 'mobile', 'tel', 'whatsapp', 'default address phone'].forEach(h => HEADER_MAP[h] = 'phone');

// CPF / Document
['cpf', 'cpf/cnpj', 'cpf_cnpj', 'document', 'documento', 'tax_id', 'tax id', 'identification', 'identificação', 'rut'].forEach(h => HEADER_MAP[h] = 'cpf');

// CNPJ
['cnpj'].forEach(h => HEADER_MAP[h] = 'cnpj');

// Company
['company', 'company_name', 'empresa', 'razão social', 'default address company'].forEach(h => HEADER_MAP[h] = 'company_name');

// Status
['status', 'estado'].forEach(h => HEADER_MAP[h] = 'status');

// Marketing consent
['accepts email marketing', 'accepts_email_marketing', 'marketing', 'newsletter', 'opt_in', 'aceita email marketing', 'aceita marketing'].forEach(h => HEADER_MAP[h] = 'accepts_marketing');

// Total spent
['total spent', 'total_spent', 'total gasto', 'lifetime_value', 'ltv', 'valor total'].forEach(h => HEADER_MAP[h] = 'total_spent');

// Total orders
['total orders', 'total_orders', 'total pedidos', 'orders_count', 'número de pedidos', 'pedidos'].forEach(h => HEADER_MAP[h] = 'total_orders');

// Notes
['note', 'notes', 'observações', 'observacao', 'notas', 'tags'].forEach(h => HEADER_MAP[h] = 'notes');

// Address fields
['default address address1', 'address1', 'address', 'endereço', 'rua', 'logradouro', 'street', 'dirección'].forEach(h => HEADER_MAP[h] = 'street');
['default address address2', 'address2', 'complemento', 'complement', 'apt'].forEach(h => HEADER_MAP[h] = 'complement');
['default address city', 'city', 'cidade', 'ciudad'].forEach(h => HEADER_MAP[h] = 'city');
['default address province code', 'state', 'estado', 'uf', 'province', 'provincia', 'região'].forEach(h => HEADER_MAP[h] = 'state');
['default address zip', 'zip', 'postal_code', 'cep', 'zipcode', 'zip code', 'código postal'].forEach(h => HEADER_MAP[h] = 'postal_code');
['default address country code', 'country', 'país', 'pais', 'country_code'].forEach(h => HEADER_MAP[h] = 'country');
['number', 'número', 'numero', 'nro'].forEach(h => HEADER_MAP[h] = 'number');
['neighborhood', 'bairro', 'barrio'].forEach(h => HEADER_MAP[h] = 'neighborhood');

// Birth date
['birth_date', 'birthday', 'data de nascimento', 'data_nascimento', 'aniversário', 'fecha_nacimiento'].forEach(h => HEADER_MAP[h] = 'birth_date');

// Gender
['gender', 'sexo', 'gênero', 'genero'].forEach(h => HEADER_MAP[h] = 'gender');

// Person type
['person_type', 'tipo pessoa', 'tipo_pessoa'].forEach(h => HEADER_MAP[h] = 'person_type');

// SMS marketing
['accepts sms marketing', 'accepts_sms_marketing', 'sms', 'aceita sms'].forEach(h => HEADER_MAP[h] = 'accepts_sms');

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapHeaders(rawHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const normalized = rawHeaders[i].toLowerCase().trim().replace(/^["']|["']$/g, '');
    const field = HEADER_MAP[normalized];
    if (field) {
      mapping[i] = field;
    }
  }
  return mapping;
}

function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const rawHeaders = parseCSVLine(lines[0]);
  const headerMapping = mapHeaders(rawHeaders);
  
  console.log('Header mapping:', JSON.stringify(headerMapping));
  
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    
    for (const [idx, field] of Object.entries(headerMapping)) {
      record[field] = values[parseInt(idx)] || '';
    }
    
    // Handle first_name + last_name → full_name
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { csvContent, tenantId } = await req.json();

    if (!csvContent || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing csvContent or tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'User does not have access to this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['owner', 'admin', 'operator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'User does not have permission to import customers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing CSV with universal header mapping...');
    const parsedRecords = parseCSV(csvContent);
    console.log(`Parsed ${parsedRecords.length} records from CSV`);

    if (parsedRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid records found in CSV. Check that headers match expected formats.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing emails
    const { data: existingCustomers } = await supabaseAdmin
      .from('customers')
      .select('email')
      .eq('tenant_id', tenantId);

    const existingEmails = new Set((existingCustomers || []).map(c => c.email.toLowerCase()));

    // Get or create "Cliente" tag
    let clienteTagId: string | null = null;
    const { data: existingTag } = await supabaseAdmin
      .from('customer_tags')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', 'Cliente')
      .maybeSingle();

    if (existingTag) {
      clienteTagId = existingTag.id;
    } else {
      const { data: newTag } = await supabaseAdmin
        .from('customer_tags')
        .insert({ tenant_id: tenantId, name: 'Cliente', color: '#10B981', description: 'Tag automática para clientes' })
        .select('id')
        .single();
      if (newTag) clienteTagId = newTag.id;
    }

    // Get or create "Clientes" email marketing list
    let clientesListId: string | null = null;
    if (clienteTagId) {
      const { data: existingList } = await supabaseAdmin
        .from('email_marketing_lists')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('tag_id', clienteTagId)
        .maybeSingle();

      if (existingList) {
        clientesListId = existingList.id;
      } else {
        const { data: newList } = await supabaseAdmin
          .from('email_marketing_lists')
          .insert({ tenant_id: tenantId, name: 'Clientes', description: 'Lista automática de clientes', tag_id: clienteTagId })
          .select('id')
          .single();
        if (newList) clientesListId = newList.id;
      }
    }

    const customersToInsert: any[] = [];
    const addressesToInsert: any[] = [];
    const tagAssignments: any[] = [];
    const subscribersToInsert: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const rec of parsedRecords) {
      const email = rec.email?.toLowerCase().trim();
      
      if (!email || !email.includes('@')) {
        errors.push(`Record missing valid email: ${rec.full_name || 'unknown'}`);
        continue;
      }

      if (existingEmails.has(email)) {
        skipped.push(email);
        continue;
      }

      existingEmails.add(email);

      const fullName = rec.full_name || rec.email?.split('@')[0] || 'Cliente';
      const phone = cleanPhone(rec.phone || '');
      const acceptsMarketing = parseBooleanYes(rec.accepts_marketing || 'yes');
      const totalSpent = parseNumber(rec.total_spent || '0');
      const totalOrders = parseInt(rec.total_orders || '0') || 0;

      const customerId = crypto.randomUUID();

      customersToInsert.push({
        id: customerId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        phone,
        cpf: rec.cpf || null,
        cnpj: rec.cnpj || null,
        company_name: rec.company_name || null,
        person_type: rec.person_type || null,
        status: 'active',
        accepts_marketing: acceptsMarketing,
        accepts_email_marketing: acceptsMarketing,
        total_orders: totalOrders,
        total_spent: totalSpent,
        average_ticket: totalOrders > 0 ? totalSpent / totalOrders : 0,
        notes: rec.notes || null,
      });

      if (clienteTagId) {
        tagAssignments.push({ customer_id: customerId, tag_id: clienteTagId });
      }

      // Email marketing subscriber
      subscribersToInsert.push({
        tenant_id: tenantId,
        email,
        name: fullName,
        phone,
        source: 'import',
        created_from: 'import',
        status: 'active',
        customer_id: customerId,
      });

      // Address if available
      if (rec.street && rec.city) {
        addressesToInsert.push({
          customer_id: customerId,
          label: 'Principal',
          is_default: true,
          recipient_name: fullName,
          street: rec.street || '',
          number: rec.number || '',
          complement: rec.complement || null,
          neighborhood: rec.neighborhood || '',
          city: rec.city || '',
          state: rec.state || '',
          postal_code: rec.postal_code?.replace(/['"]/g, '') || '',
          country: rec.country || 'BR',
        });
      }
    }

    console.log(`Inserting ${customersToInsert.length} customers...`);

    const BATCH_SIZE = 500;
    let insertedCustomers = 0;
    let insertedAddresses = 0;

    // Insert customers
    for (let i = 0; i < customersToInsert.length; i += BATCH_SIZE) {
      const batch = customersToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabaseAdmin.from('customers').insert(batch);
      if (insertError) {
        console.error('Error inserting customers batch:', insertError);
        errors.push(`Batch error: ${insertError.message}`);
      } else {
        insertedCustomers += batch.length;
      }
    }

    // Insert addresses
    for (let i = 0; i < addressesToInsert.length; i += BATCH_SIZE) {
      const batch = addressesToInsert.slice(i, i + BATCH_SIZE);
      const { error: addrError } = await supabaseAdmin.from('customer_addresses').insert(batch);
      if (addrError) console.error('Error inserting addresses:', addrError);
      else insertedAddresses += batch.length;
    }

    // Insert tag assignments
    let insertedTags = 0;
    for (let i = 0; i < tagAssignments.length; i += BATCH_SIZE) {
      const batch = tagAssignments.slice(i, i + BATCH_SIZE);
      const { error: tagError } = await supabaseAdmin.from('customer_tag_assignments').insert(batch);
      if (!tagError) insertedTags += batch.length;
    }

    // Insert email marketing subscribers
    let insertedSubscribers = 0;
    for (let i = 0; i < subscribersToInsert.length; i += BATCH_SIZE) {
      const batch = subscribersToInsert.slice(i, i + BATCH_SIZE);
      const { error: subError } = await supabaseAdmin
        .from('email_marketing_subscribers')
        .upsert(batch, { onConflict: 'tenant_id,email', ignoreDuplicates: true });
      if (!subError) insertedSubscribers += batch.length;
      else console.error('Error inserting subscribers:', subError);
    }

    // Add subscribers to Clientes list
    if (clientesListId && subscribersToInsert.length > 0) {
      // Get the subscriber IDs we just inserted
      const emails = subscribersToInsert.map(s => s.email);
      const { data: subs } = await supabaseAdmin
        .from('email_marketing_subscribers')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('email', emails);

      if (subs) {
        const listMembers = subs.map(s => ({
          tenant_id: tenantId,
          list_id: clientesListId,
          subscriber_id: s.id,
        }));
        for (let i = 0; i < listMembers.length; i += BATCH_SIZE) {
          const batch = listMembers.slice(i, i + BATCH_SIZE);
          await supabaseAdmin
            .from('email_marketing_list_members')
            .upsert(batch, { onConflict: 'list_id,subscriber_id', ignoreDuplicates: true });
        }
      }
    }

    console.log(`Import complete: ${insertedCustomers} customers, ${insertedAddresses} addresses, ${insertedTags} tags, ${insertedSubscribers} subscribers`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: insertedCustomers,
        addresses: insertedAddresses,
        skipped: skipped.length,
        errors: errors.length,
        details: {
          skippedEmails: skipped.slice(0, 10),
          errorMessages: errors.slice(0, 10),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Import error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
