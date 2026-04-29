// Frenet adapter — gateway integration for shipment sync + invoice attachment
// Docs: https://api.frenet.com.br/swagger/ui/index

const FRENET_BASE = "https://sp.api.frenet.com.br";

interface FrenetCredentials {
  token: string;
}

interface OrderForSync {
  id: string;
  order_number?: string | number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_cpf?: string | null;
  customer_cnpj?: string | null;
  shipping_address?: any;
  shipping_carrier?: string | null;
  shipping_method?: string | null;
  shipping_cost?: number | null;
  total?: number | null;
  items?: Array<{
    sku?: string | null;
    name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    weight_grams?: number | null;
    height_cm?: number | null;
    width_cm?: number | null;
    length_cm?: number | null;
  }>;
}

interface InvoiceData {
  chave: string;
  numero?: string | null;
  serie?: string | null;
  data_emissao?: string | null;
  valor?: number | null;
  xml_url?: string | null;
}

function pickAddress(o: OrderForSync) {
  const a = o.shipping_address || {};
  return {
    Street: a.street || a.address || "",
    Number: a.number || "",
    Complement: a.complement || "",
    District: a.neighborhood || a.district || "",
    City: a.city || "",
    State: a.state || a.uf || "",
    PostalCode: (a.zip_code || a.cep || "").replace(/\D/g, ""),
    Country: "BR",
  };
}

export const frenetAdapter = {
  /**
   * Sync the order to Frenet immediately after payment approval.
   * Frenet receives the shipment data so it appears in the merchant's Frenet panel.
   */
  async syncOrder(creds: FrenetCredentials, order: OrderForSync): Promise<{ external_ref: string; raw: any }> {
    const items = (order.items || []).map((it) => ({
      Weight: ((it.weight_grams || 0) / 1000), // Frenet expects KG
      Length: it.length_cm || 16,
      Height: it.height_cm || 2,
      Width: it.width_cm || 11,
      Quantity: it.quantity || 1,
      SKU: it.sku || "",
      ProductDescription: it.name || "",
      ProductPrice: it.unit_price || 0,
    }));

    const body = {
      OrderNumber: String(order.order_number ?? order.id),
      ShippingServiceCode: order.shipping_method || "",
      Recipient: {
        Name: order.customer_name || "",
        Email: order.customer_email || "",
        PhoneNumber: order.customer_phone || "",
        CpfCnpj: order.customer_cpf || order.customer_cnpj || "",
        Address: pickAddress(order),
      },
      ShippingItemArray: items,
      ShippingPrice: order.shipping_cost || 0,
      OrderTotal: order.total || 0,
    };

    const res = await fetch(`${FRENET_BASE}/shipping/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: creds.token,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok || raw?.ShippingSefazError) {
      throw new Error(`Frenet syncOrder failed: ${res.status} ${JSON.stringify(raw)}`);
    }

    return {
      external_ref: raw?.OrderId || raw?.TrackingNumber || String(order.id),
      raw,
    };
  },

  /**
   * Attach the issued invoice (NF-e) to a previously synced Frenet shipment.
   */
  async attachInvoice(creds: FrenetCredentials, order: OrderForSync, invoice: InvoiceData): Promise<{ raw: any }> {
    const body = {
      OrderNumber: String(order.order_number ?? order.id),
      InvoiceNumber: invoice.numero || "",
      InvoiceSerie: invoice.serie || "",
      InvoiceKey: invoice.chave,
      InvoiceDate: invoice.data_emissao || new Date().toISOString(),
      InvoiceValue: invoice.valor ?? order.total ?? 0,
      InvoiceXmlUrl: invoice.xml_url || "",
    };

    const res = await fetch(`${FRENET_BASE}/shipping/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: creds.token,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok || raw?.ShippingSefazError) {
      throw new Error(`Frenet attachInvoice failed: ${res.status} ${JSON.stringify(raw)}`);
    }
    return { raw };
  },
};

export type GatewayAdapter = typeof frenetAdapter;
