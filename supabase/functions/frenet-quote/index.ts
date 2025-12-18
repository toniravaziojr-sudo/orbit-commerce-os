import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShippingQuoteRequest {
  seller_cep: string;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FRENET_KEY = Deno.env.get('FRENET_KEY');
    const FRENET_PASSWORD = Deno.env.get('FRENET_PASSWORD');
    const FRENET_TOKEN = Deno.env.get('FRENET_TOKEN');

    if (!FRENET_TOKEN) {
      console.error('FRENET_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Frenet not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ShippingQuoteRequest = await req.json();
    console.log('Frenet quote request:', JSON.stringify(body));

    const { seller_cep, recipient_cep, items } = body;

    if (!seller_cep || !recipient_cep || !items?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: seller_cep, recipient_cep, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      SellerCEP: seller_cep.replace(/\D/g, ''),
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
        'token': FRENET_TOKEN
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

    // Parse shipping services
    const services: FrenetShippingService[] = frenetData.ShippingSevicesArray || [];
    
    const options = services
      .filter(s => !s.Error && s.ShippingPrice > 0)
      .map(s => ({
        code: s.ServiceCode,
        label: `${s.Carrier} - ${s.ServiceDescription}`,
        carrier: s.Carrier,
        service: s.ServiceDescription,
        price: s.ShippingPrice,
        deliveryDays: s.DeliveryTime,
        isFree: false
      }))
      .sort((a, b) => a.price - b.price);

    console.log('Parsed shipping options:', JSON.stringify(options));

    return new Response(
      JSON.stringify({
        success: true,
        options,
        seller_cep,
        recipient_cep,
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
