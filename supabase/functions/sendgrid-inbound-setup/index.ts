import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetupRequest {
  action: 'setup' | 'remove' | 'check';
  hostname: string;
  tenant_id: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== SENDGRID INBOUND SETUP ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

    if (!sendgridApiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, hostname, tenant_id }: SetupRequest = await req.json();

    if (!hostname || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing hostname or tenant_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!userRole || !['owner', 'admin'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookUrl = `https://app.comandocentral.com.br/integrations/emails/inbound`;

    if (action === 'check') {
      // Check if hostname is already configured
      const checkResponse = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!checkResponse.ok) {
        const errorText = await checkResponse.text();
        console.error('SendGrid API error:', errorText);
        throw new Error('Failed to check SendGrid settings');
      }

      const settings = await checkResponse.json();
      const existingConfig = settings.result?.find((s: { hostname: string }) => s.hostname === hostname);

      return new Response(
        JSON.stringify({ 
          configured: !!existingConfig,
          hostname,
          webhook_url: existingConfig?.url || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'setup') {
      console.log('Setting up Inbound Parse for:', hostname);

      // First check if already exists
      const checkResponse = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const settings = await checkResponse.json();
      const existingConfig = settings.result?.find((s: { hostname: string }) => s.hostname === hostname);

      if (existingConfig) {
        // Update existing
        const updateResponse = await fetch(`https://api.sendgrid.com/v3/user/webhooks/parse/settings/${hostname}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: webhookUrl,
            spam_check: true,
            send_raw: false,
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('SendGrid update error:', errorText);
          throw new Error('Failed to update Inbound Parse settings');
        }

        console.log('Updated existing Inbound Parse config');
      } else {
        // Create new
        const createResponse = await fetch('https://api.sendgrid.com/v3/user/webhooks/parse/settings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendgridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hostname,
            url: webhookUrl,
            spam_check: true,
            send_raw: false,
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('SendGrid create error:', errorText);
          
          // Check for common errors
          if (errorText.includes('already exists')) {
            console.log('Hostname already exists, trying to update...');
          } else {
            throw new Error(`Failed to create Inbound Parse: ${errorText}`);
          }
        }

        console.log('Created new Inbound Parse config');
      }

      // Update tenant config to mark as configured
      await supabase
        .from('email_provider_configs')
        .update({
          support_connection_status: 'active',
          support_last_error: null,
        })
        .eq('tenant_id', tenant_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Inbound Parse configured successfully',
          hostname,
          webhook_url: webhookUrl
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove') {
      console.log('Removing Inbound Parse for:', hostname);

      const deleteResponse = await fetch(`https://api.sendgrid.com/v3/user/webhooks/parse/settings/${hostname}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text();
        console.error('SendGrid delete error:', errorText);
        throw new Error('Failed to remove Inbound Parse settings');
      }

      // Update tenant config
      await supabase
        .from('email_provider_configs')
        .update({
          support_connection_status: 'not_configured',
        })
        .eq('tenant_id', tenant_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Inbound Parse removed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
