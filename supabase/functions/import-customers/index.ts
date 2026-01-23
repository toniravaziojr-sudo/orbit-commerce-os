import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyCustomer {
  'Customer ID': string;
  'First Name': string;
  'Last Name': string;
  'Email': string;
  'Accepts Email Marketing': string;
  'Default Address Company': string;
  'Default Address Address1': string;
  'Default Address Address2': string;
  'Default Address City': string;
  'Default Address Province Code': string;
  'Default Address Country Code': string;
  'Default Address Zip': string;
  'Default Address Phone': string;
  'Phone': string;
  'Accepts SMS Marketing': string;
  'Total Spent': string;
  'Total Orders': string;
  'Note': string;
  'Tax Exempt': string;
  'Tags': string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseCSV(csvContent: string): ShopifyCustomer[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const customers: ShopifyCustomer[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const customer: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      customer[header] = values[index] || '';
    });
    customers.push(customer as unknown as ShopifyCustomer);
  }
  
  return customers;
}

function cleanPhone(phone: string): string | null {
  if (!phone) return null;
  // Remove quotes and clean phone
  const cleaned = phone.replace(/['"]/g, '').replace(/[^\d+]/g, '');
  return cleaned || null;
}

function parseNumber(value: string): number {
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : num;
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

    // Create Supabase client with service role for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify user has access to the tenant
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

    // Check user has role in tenant
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

    console.log('Parsing CSV...');
    const shopifyCustomers = parseCSV(csvContent);
    console.log(`Parsed ${shopifyCustomers.length} customers from CSV`);

    if (shopifyCustomers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid customers found in CSV' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing emails to avoid duplicates
    const { data: existingCustomers } = await supabaseAdmin
      .from('customers')
      .select('email')
      .eq('tenant_id', tenantId);

    const existingEmails = new Set((existingCustomers || []).map(c => c.email.toLowerCase()));

    // === CREATE OR GET "Cliente" TAG AND "Clientes" LIST ===
    // First, try to find existing "Cliente" tag
    let clienteTagId: string | null = null;
    const { data: existingTag } = await supabaseAdmin
      .from('customer_tags')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', 'Cliente')
      .maybeSingle();

    if (existingTag) {
      clienteTagId = existingTag.id;
      console.log('Found existing "Cliente" tag:', clienteTagId);
    } else {
      // Create the "Cliente" tag
      const { data: newTag, error: tagError } = await supabaseAdmin
        .from('customer_tags')
        .insert({
          tenant_id: tenantId,
          name: 'Cliente',
          color: '#10B981', // Green color
          description: 'Tag automática para clientes importados'
        })
        .select('id')
        .single();

      if (!tagError && newTag) {
        clienteTagId = newTag.id;
        console.log('Created "Cliente" tag:', clienteTagId);
      } else {
        console.error('Error creating Cliente tag:', tagError);
      }
    }

    // Create or get "Clientes" list in email marketing (linked to tag)
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
        console.log('Found existing "Clientes" list:', clientesListId);
      } else {
        const { data: newList, error: listError } = await supabaseAdmin
          .from('email_marketing_lists')
          .insert({
            tenant_id: tenantId,
            name: 'Clientes',
            description: 'Lista automática de clientes importados',
            tag_id: clienteTagId
          })
          .select('id')
          .single();

        if (!listError && newList) {
          clientesListId = newList.id;
          console.log('Created "Clientes" list:', clientesListId);
        } else {
          console.error('Error creating Clientes list:', listError);
        }
      }
    }

    // Prepare customers for insert
    const customersToInsert: Array<{
      id: string;
      tenant_id: string;
      email: string;
      full_name: string;
      phone: string | null;
      status: string;
      accepts_marketing: boolean;
      total_orders: number;
      total_spent: number;
      average_ticket: number;
    }> = [];
    const addressesToInsert: Array<{
      customer_id: string;
      label: string;
      is_default: boolean;
      recipient_name: string;
      street: string;
      number: string;
      complement: string | null;
      neighborhood: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    }> = [];
    const tagAssignments: Array<{ customer_id: string; tag_id: string }> = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const sc of shopifyCustomers) {
      const email = sc['Email']?.toLowerCase().trim();
      
      if (!email || email === '') {
        errors.push(`Customer ${sc['First Name']} ${sc['Last Name']}: missing email`);
        continue;
      }

      if (existingEmails.has(email)) {
        skipped.push(email);
        continue;
      }

      // Add to set to prevent duplicates within the import
      existingEmails.add(email);

      const fullName = `${sc['First Name'] || ''} ${sc['Last Name'] || ''}`.trim() || 'Cliente';
      const phone = cleanPhone(sc['Phone']) || cleanPhone(sc['Default Address Phone']);
      const acceptsMarketing = sc['Accepts Email Marketing']?.toLowerCase() === 'yes';
      const totalSpent = parseNumber(sc['Total Spent']);
      const totalOrders = parseInt(sc['Total Orders']) || 0;

      const customerId = crypto.randomUUID();

      customersToInsert.push({
        id: customerId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        phone,
        status: 'active',
        accepts_marketing: acceptsMarketing,
        total_orders: totalOrders,
        total_spent: totalSpent,
        average_ticket: totalOrders > 0 ? totalSpent / totalOrders : 0,
      });

      // Add tag assignment for "Cliente" tag
      if (clienteTagId) {
        tagAssignments.push({
          customer_id: customerId,
          tag_id: clienteTagId
        });
      }

      // If has address, prepare it
      if (sc['Default Address Address1'] && sc['Default Address City']) {
        addressesToInsert.push({
          customer_id: customerId,
          label: 'Principal',
          is_default: true,
          recipient_name: fullName,
          street: sc['Default Address Address1'] || '',
          number: '',
          complement: sc['Default Address Address2'] || null,
          neighborhood: '',
          city: sc['Default Address City'] || '',
          state: sc['Default Address Province Code'] || '',
          postal_code: sc['Default Address Zip']?.replace(/['"]/g, '') || '',
          country: sc['Default Address Country Code'] || 'BR',
        });
      }
    }

    console.log(`Inserting ${customersToInsert.length} customers...`);

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let insertedCustomers = 0;
    let insertedAddresses = 0;

    for (let i = 0; i < customersToInsert.length; i += BATCH_SIZE) {
      const batch = customersToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabaseAdmin
        .from('customers')
        .insert(batch);

      if (insertError) {
        console.error('Error inserting customers batch:', insertError);
        errors.push(`Batch ${i / BATCH_SIZE + 1} error: ${insertError.message}`);
      } else {
        insertedCustomers += batch.length;
      }
    }

    // Insert addresses in batches
    for (let i = 0; i < addressesToInsert.length; i += BATCH_SIZE) {
      const batch = addressesToInsert.slice(i, i + BATCH_SIZE);
      const { error: addrError } = await supabaseAdmin
        .from('customer_addresses')
        .insert(batch);

      if (addrError) {
        console.error('Error inserting addresses batch:', addrError);
      } else {
        insertedAddresses += batch.length;
      }
    }

    // Insert tag assignments in batches
    let insertedTags = 0;
    if (tagAssignments.length > 0) {
      console.log(`Assigning "Cliente" tag to ${tagAssignments.length} customers...`);
      for (let i = 0; i < tagAssignments.length; i += BATCH_SIZE) {
        const batch = tagAssignments.slice(i, i + BATCH_SIZE);
        const { error: tagError } = await supabaseAdmin
          .from('customer_tag_assignments')
          .insert(batch);

        if (tagError) {
          console.error('Error inserting tag assignments batch:', tagError);
        } else {
          insertedTags += batch.length;
        }
      }
      console.log(`Assigned "Cliente" tag to ${insertedTags} customers`);
    }

    console.log(`Import complete: ${insertedCustomers} customers, ${insertedAddresses} addresses, ${insertedTags} tags`);

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
