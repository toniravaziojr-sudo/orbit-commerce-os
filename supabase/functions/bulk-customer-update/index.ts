import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { tenant_id, customers } = await req.json();

    if (!tenant_id || !customers || !Array.isArray(customers)) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or customers array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedCount = 0;
    let addressCount = 0;
    const errors: string[] = [];

    for (const c of customers) {
      try {
        // Find customer by email
        const { data: existing } = await supabase
          .from('customers')
          .select('id, phone, notes, total_spent, total_orders, accepts_email_marketing, accepts_sms_marketing')
          .eq('tenant_id', tenant_id)
          .eq('email', c.email)
          .limit(1)
          .single();

        if (!existing) continue;

        // Update customer fields
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (c.phone && (!existing.phone || existing.phone === '')) {
          updates.phone = c.phone;
        }
        if (c.accepts_email) updates.accepts_email_marketing = true;
        if (c.accepts_sms) updates.accepts_sms_marketing = true;
        if (c.notes && (!existing.notes || existing.notes === '')) {
          updates.notes = c.notes;
        }
        if (c.total_spent > 0 && (existing.total_spent === 0 || existing.total_spent === null)) {
          updates.total_spent = c.total_spent;
        }
        if (c.total_orders > 0 && (existing.total_orders === 0 || existing.total_orders === null)) {
          updates.total_orders = c.total_orders;
        }

        const { error: updateError } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`Update ${c.email}: ${updateError.message}`);
        } else {
          updatedCount++;
        }

        // Insert address if provided and customer doesn't have one
        if (c.addr_street && c.addr_city) {
          const { data: existingAddr } = await supabase
            .from('customer_addresses')
            .select('id')
            .eq('customer_id', existing.id)
            .limit(1);

          if (!existingAddr || existingAddr.length === 0) {
            const { error: addrError } = await supabase
              .from('customer_addresses')
              .insert({
                customer_id: existing.id,
                label: 'Principal',
                is_default: true,
                recipient_name: c.full_name || '',
                street: c.addr_street,
                complement: c.addr_complement || null,
                city: c.addr_city,
                state: c.addr_state || null,
                postal_code: c.addr_zip || null,
                country: c.addr_country || 'BR',
              });

            if (addrError) {
              errors.push(`Addr ${c.email}: ${addrError.message}`);
            } else {
              addressCount++;
            }
          }
        }
      } catch (e) {
        errors.push(`${c.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated: updatedCount,
      addresses_created: addressCount,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
