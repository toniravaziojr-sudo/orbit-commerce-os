// ============================================
// FRENET QUOTE - Shipping quote
// Uses database config first, falls back to Secrets
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Fallback to environment secrets
const ENV_FRENET_TOKEN = Deno.env.get('FRENET_TOKEN');

interface ShippingQuoteRequest {
  tenant_id: string;
  seller_cep?: string; // Optional - will use config if not provided
  recipient_cep: string;
  items: Array<{
    weight: number; // kg
    height: number; // cm
    width: number;  // cm
    length: number; // cm
    quantity: number;
    price: number;  // R$
  }>;
}

interface FrenetShippingService {
  ServiceCode: string;
  ServiceDescription: string;
  Carrier: string;
  ShippingPrice: number;
  DeliveryTime: number;
  Error: boolean;
  Msg: string | null;
}

// Get Frenet credentials from database or fallback to Secrets
async function getFrenetCredentials(supabase: any, tenantId: string): Promise<{
  token: string;
  originCep: string;
  source: 'database' | 'fallback';
}> {
  // Try database first
  const { data: provider } = await supabase
    .from('shipping_providers')
    .select('credentials, settings, is_enabled')
    .eq('tenant_id', tenantId)
    .eq('provider', 'frenet')
    .single();

  if (provider?.is_enabled && provider?.credentials?.token) {
    console.log('[Frenet] Using database credentials');
    // Check seller_cep in both credentials and settings
    const originCep = provider.credentials.seller_cep || provider.settings?.origin_cep || '01310100';
    return {
      token: provider.credentials.token,
      originCep: originCep.replace(/\D/g, ''),
      source: 'database',
    };
  }

  // Fallback to environment secrets
  if (ENV_FRENET_TOKEN) {
    console.log('[Frenet] Using fallback (Secrets)');
    return {
      token: ENV_FRENET_TOKEN,
      originCep: '01310100', // Default CEP for fallback
      source: 'fallback',
    };
  }

  throw new Error('Frenet não configurado. Configure em Sistema → Integrações.');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ShippingQuoteRequest = await req.json();
    console.log('Frenet quote request:', JSON.stringify(body));

    const { tenant_id, recipient_cep, items } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipient_cep || !items?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_cep, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get credentials from database or fallback
    const credentials = await getFrenetCredentials(supabase, tenant_id);
    console.log(`[Frenet] Using ${credentials.source} credentials, origin CEP: ${credentials.originCep}`);

    // Use provided seller_cep or config origin_cep
    const sellerCep = body.seller_cep || credentials.originCep;

    // Calculate totals
    let totalWeight = 0;
    let totalHeight = 0;
    let totalWidth = 0;
    let totalLength = 0;
    let totalValue = 0;

    for (const item of items) {
      totalWeight += (item.weight || 0.3) * item.quantity;
      totalHeight = Math.max(totalHeight, item.height || 10);
      totalWidth = Math.max(totalWidth, item.width || 10);
      totalLength += (item.length || 10) * item.quantity;
      totalValue += item.price * item.quantity;
    }

    // Ensure minimum dimensions
    totalWeight = Math.max(totalWeight, 0.3);
    totalHeight = Math.max(totalHeight, 2);
    totalWidth = Math.max(totalWidth, 11);
    totalLength = Math.max(totalLength, 16);

    // Frenet API request
    const frenetPayload = {
      SellerCEP: sellerCep.replace(/\D/g, ''),
      RecipientCEP: recipient_cep.replace(/\D/g, ''),
      ShipmentInvoiceValue: totalValue,
      ShippingServiceCode: null, // Get all services
      ShippingItemArray: [{
        Height: totalHeight,
        Length: totalLength,
        Width: totalWidth,
        Weight: totalWeight,
        Quantity: 1,
        SKU: 'QUOTE',
        Category: 'Geral'
      }],
      RecipientCountry: 'BR'
    };

    console.log('Frenet API payload:', JSON.stringify(frenetPayload));

    const frenetResponse = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': credentials.token
      },
      body: JSON.stringify(frenetPayload)
    });

    const frenetData = await frenetResponse.json();
    console.log('Frenet API response:', JSON.stringify(frenetData));

    if (!frenetResponse.ok) {
      console.error('Frenet API error:', frenetData);
      return new Response(
        JSON.stringify({ error: 'Frenet API error', details: frenetData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse shipping services - include free shipping options (price = 0)
    const services: FrenetShippingService[] = frenetData.ShippingSevicesArray || [];
    
    const options = services
      .filter(s => !s.Error && parseFloat(String(s.ShippingPrice)) >= 0)
      .map(s => {
        const price = parseFloat(String(s.ShippingPrice)) || 0;
        const deliveryDays = parseInt(String(s.DeliveryTime), 10) || 5;
        return {
          code: s.ServiceCode,
          label: `${s.Carrier} - ${s.ServiceDescription}`,
          carrier: s.Carrier,
          service: s.ServiceDescription,
          price: price, // Keep as number for frontend
          deliveryDays: deliveryDays, // Keep as number for frontend
          isFree: price === 0
        };
      })
      .sort((a, b) => a.price - b.price);

    console.log('Parsed shipping options:', JSON.stringify(options));

    return new Response(
      JSON.stringify({
        success: true,
        options,
        seller_cep: sellerCep,
        recipient_cep,
        credential_source: credentials.source,
        totals: {
          weight: totalWeight,
          height: totalHeight,
          width: totalWidth,
          length: totalLength,
          value: totalValue
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Frenet quote error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
