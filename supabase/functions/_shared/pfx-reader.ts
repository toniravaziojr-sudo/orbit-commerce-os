// =============================================
// PFX READER — Camada única de leitura de certificado A1
// =============================================
// REGRA ANTI-REGRESSÃO (mem://constraints/pfx-reader-single-source):
// Toda função fiscal que precise abrir um arquivo .pfx (PKCS#12) DEVE
// usar exclusivamente `readPfx()` deste módulo. É proibido importar
// `node-forge` diretamente em qualquer função fiscal para abrir PFX.
//
// Estratégia: tenta primeiro PKI.js (moderno: suporta PBES2/AES-256),
// em caso de falha estrutural cai para node-forge (legado: TripleDES).
// Erros de senha NÃO disparam fallback (a senha é a mesma).
// =============================================

// deno-lint-ignore-file no-explicit-any

export type PfxErrorCode =
  | "NOT_PFX"            // arquivo PEM ou base64 inválido
  | "CORRUPT"            // ASN.1/DER corrompido
  | "WRONG_PASSWORD"     // MAC inválido
  | "UNSUPPORTED_CIPHER" // cifra desconhecida pelos dois leitores
  | "MISSING_KEY"        // PFX sem chave privada
  | "MISSING_CERT"       // PFX sem certificado
  | "UNKNOWN";

export class PfxError extends Error {
  code: PfxErrorCode;
  constructor(code: PfxErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface PfxSubjectAttr {
  type: string;     // OID
  shortName?: string; // CN, O, OU, etc
  value: string;
}

export interface PfxValidity {
  notBefore: Date;
  notAfter: Date;
}

export interface PfxBundle {
  /** Chave privada em PEM PKCS#8 (texto), pronta para Web Crypto e forge */
  privateKeyPem: string;
  /** Certificado em PEM (texto, com headers) */
  certificatePem: string;
  /** Conteúdo base64 do certificado SEM headers (para uso no XML) */
  certificateBase64: string;
  subject: PfxSubjectAttr[];
  /** Common Name (CN) do titular, se existir */
  cn: string | null;
  /** Primeiros 14 dígitos consecutivos achados no subject/altNames (CNPJ ICP-Brasil) */
  cnpj: string | null;
  serialNumber: string;
  validity: PfxValidity;
  /** Qual leitor conseguiu abrir o arquivo */
  reader: "pkijs" | "forge";
}

// ---------- helpers ----------

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function pemWrap(label: string, bytes: Uint8Array): string {
  const b64 = bytesToBase64(bytes);
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function stripPem(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function classifyError(raw: unknown): PfxErrorCode {
  const msg = String((raw as any)?.message ?? raw ?? "").toLowerCase();
  if (/mac|integrity|invalid password|password is incorrect|wrong password/.test(msg)) {
    return "WRONG_PASSWORD";
  }
  if (/unsupported|not supported|unknown oid|algorithm|cipher|pbes|aes/.test(msg)) {
    return "UNSUPPORTED_CIPHER";
  }
  if (/asn|der|ber|parse|invalid|truncat|malformed|offset/.test(msg)) {
    return "CORRUPT";
  }
  return "UNKNOWN";
}

// OID -> short name (mínimo necessário)
const OID_SHORT: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "1.2.840.113549.1.9.1": "emailAddress",
};

function pickCn(subject: PfxSubjectAttr[]): string | null {
  const cn = subject.find((a) => a.shortName === "CN");
  return cn?.value ?? null;
}

function pickCnpj(subject: PfxSubjectAttr[], extraTexts: string[] = []): string | null {
  const all = [...subject.map((a) => a.value), ...extraTexts].join(" ");
  const m = all.match(/\d{14}/);
  return m ? m[0] : null;
}

// ---------- leitor moderno: PKI.js ----------

async function readPfxWithPkijs(
  pfxBytes: Uint8Array,
  password: string,
): Promise<PfxBundle> {
  const pkijs: any = await import("npm:pkijs@3.2.4");
  const asn1js: any = await import("npm:asn1js@3.0.5");

  const engine = new pkijs.CryptoEngine({
    name: "webcrypto",
    crypto: globalThis.crypto,
    subtle: globalThis.crypto.subtle,
  });
  pkijs.setEngine("webcrypto", engine);

  // Decodifica DER
  const ab = pfxBytes.buffer.slice(
    pfxBytes.byteOffset,
    pfxBytes.byteOffset + pfxBytes.byteLength,
  );
  const asn1 = asn1js.fromBER(ab);
  if (asn1.offset === -1) {
    throw new PfxError("CORRUPT", "Arquivo PFX não pôde ser decodificado");
  }

  const pfx = new pkijs.PFX({ schema: asn1.result });

  // Senha como ArrayBuffer (UTF-8 não — PKCS#12 usa BMPString)
  const passwordBuffer = new TextEncoder().encode(password).buffer;

  // 1) Parse AuthenticatedSafe
  await pfx.parseInternalValues({
    password: passwordBuffer,
    checkIntegrity: true,
  });

  // 2) Parse dos blocos internos conforme o tipo de cada contentInfo
  const authenticatedSafe = pfx.parsedValue.authenticatedSafe;
  if (!authenticatedSafe) {
    throw new PfxError("CORRUPT", "AuthenticatedSafe ausente no PFX");
  }

  await authenticatedSafe.parseInternalValues({
    safeContents: authenticatedSafe.safeContents.map((contentInfo: any) =>
      contentInfo.contentType === "1.2.840.113549.1.7.6"
        ? { password: passwordBuffer }
        : {}
    ),
  });

  const safeContentsArr = authenticatedSafe.parsedValue?.safeContents ?? [];

  let pkcs8Der: Uint8Array | null = null;
  let certDer: Uint8Array | null = null;

  for (let i = 0; i < safeContentsArr.length; i++) {
    const safeContent = safeContentsArr[i];
    const safeBags = safeContent?.value?.safeBags ?? [];
    for (const bag of safeBags) {
      const bagValue = bag.bagValue;

      // PKCS8ShroudedKeyBag → bagValue é encrypted, precisa decifrar
      if (bag.bagId === "1.2.840.113549.1.12.10.1.2" && bagValue) {
        if (typeof bagValue.parseInternalValues === "function") {
          await bagValue.parseInternalValues({ password: passwordBuffer });
        }
        const pk = bagValue.parsedValue ?? bagValue;
        const pkSchema = pk.toSchema?.() ?? pk;
        const pkBer = pkSchema.toBER ? pkSchema.toBER(false) : pkSchema;
        if (pkBer instanceof ArrayBuffer) {
          pkcs8Der = new Uint8Array(pkBer);
        }
      }
      // KeyBag (não cifrado)
      if (bag.bagId === "1.2.840.113549.1.12.10.1.1" && bagValue && !pkcs8Der) {
        const pkSchema = bagValue.toSchema?.() ?? bagValue;
        const pkBer = pkSchema.toBER ? pkSchema.toBER(false) : pkSchema;
        if (pkBer instanceof ArrayBuffer) {
          pkcs8Der = new Uint8Array(pkBer);
        }
      }
      // CertBag → x509
      if (bag.bagId === "1.2.840.113549.1.12.10.1.3" && bagValue && !certDer) {
        const certBuf = bagValue.parsedValue?.toSchema
          ? bagValue.parsedValue.toSchema().toBER(false)
          : bagValue.certValue?.valueBlock?.valueHex;
        if (certBuf instanceof ArrayBuffer) {
          certDer = new Uint8Array(certBuf);
        } else if (certBuf?.byteLength) {
          certDer = new Uint8Array(certBuf);
        }
      }
    }
  }

  if (!certDer) throw new PfxError("MISSING_CERT", "Certificado não encontrado no PFX");
  if (!pkcs8Der) throw new PfxError("MISSING_KEY", "Chave privada não encontrada no PFX");

  // Parse do certificado para extrair metadados
  const certAsn1 = asn1js.fromBER(certDer.buffer.slice(certDer.byteOffset, certDer.byteOffset + certDer.byteLength));
  const cert = new pkijs.Certificate({ schema: certAsn1.result });

  const subject: PfxSubjectAttr[] = (cert.subject?.typesAndValues ?? []).map((tv: any) => ({
    type: tv.type,
    shortName: OID_SHORT[tv.type],
    value: String(tv.value?.valueBlock?.value ?? ""),
  }));

  // altNames (para CNPJ ICP-Brasil, OID 2.16.76.1.3.3)
  const altTexts: string[] = [];
  for (const ext of cert.extensions ?? []) {
    if (ext.extnID === "2.5.29.17" && ext.parsedValue?.altNames) {
      for (const alt of ext.parsedValue.altNames) {
        const v = alt.value;
        if (typeof v === "string") altTexts.push(v);
        else if (v?.valueBlock?.value) altTexts.push(String(v.valueBlock.value));
        else if (v?.valueBlock?.valueHex) {
          // OtherName (ICP-Brasil) — extrai dígitos do hex bruto
          const u8 = new Uint8Array(v.valueBlock.valueHex);
          let s = "";
          for (let i = 0; i < u8.length; i++) {
            const c = u8[i];
            if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
          }
          altTexts.push(s);
        }
      }
    }
  }

  const notBefore: Date = cert.notBefore.value;
  const notAfter: Date = cert.notAfter.value;
  // serialNumber em hex
  const serialHex = Array.from(new Uint8Array(cert.serialNumber.valueBlock.valueHex))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    privateKeyPem: pemWrap("PRIVATE KEY", pkcs8Der),
    certificatePem: pemWrap("CERTIFICATE", certDer),
    certificateBase64: bytesToBase64(certDer),
    subject,
    cn: pickCn(subject),
    cnpj: pickCnpj(subject, altTexts),
    serialNumber: serialHex,
    validity: { notBefore, notAfter },
    reader: "pkijs",
  };
}

// ---------- leitor legado: node-forge ----------

async function readPfxWithForge(
  pfxBytes: Uint8Array,
  password: string,
): Promise<PfxBundle> {
  const forgeModule: any = await import("npm:node-forge@1.3.1");
  const forge: any = forgeModule.default || forgeModule;

  if (!forge?.util?.decode64 || !forge?.pkcs12) {
    throw new PfxError("UNKNOWN", "node-forge não carregou corretamente");
  }

  // PRNG polyfill
  const prng = (n: number): string => {
    const bytes = new Uint8Array(n || 32);
    crypto.getRandomValues(bytes);
    return String.fromCharCode(...bytes);
  };
  if (forge.random) {
    forge.random.seedFileSync = prng;
    if (typeof forge.random.collect === "function") {
      forge.random.collect(prng(32));
    }
  }

  // forge espera DER como string binária
  let derStr = "";
  for (let i = 0; i < pfxBytes.length; i++) derStr += String.fromCharCode(pfxBytes[i]);

  const asn1 = forge.asn1.fromDer(derStr);
  const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag?.[0]?.key) throw new PfxError("MISSING_KEY", "Chave privada não encontrada");

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag?.[0]?.cert) throw new PfxError("MISSING_CERT", "Certificado não encontrado");

  const cert = certBag[0].cert;
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);
  const certificatePem = forge.pki.certificateToPem(cert);
  const certificateBase64 = stripPem(certificatePem);

  const subject: PfxSubjectAttr[] = (cert.subject?.attributes ?? []).map((a: any) => ({
    type: a.type,
    shortName: a.shortName ?? OID_SHORT[a.type],
    value: String(a.value ?? ""),
  }));

  const altTexts: string[] = [];
  for (const ext of cert.extensions ?? []) {
    if (ext.name === "subjectAltName" && Array.isArray(ext.altNames)) {
      for (const alt of ext.altNames) {
        if (typeof alt?.value === "string") altTexts.push(alt.value);
      }
    }
  }

  return {
    privateKeyPem,
    certificatePem,
    certificateBase64,
    subject,
    cn: pickCn(subject),
    cnpj: pickCnpj(subject, altTexts),
    serialNumber: String(cert.serialNumber ?? ""),
    validity: {
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
    },
    reader: "forge",
  };
}

// ---------- API pública ----------

/**
 * Lê um certificado A1 (.pfx / PKCS#12) em formato base64.
 * Tenta primeiro o leitor moderno (PKI.js, suporta PBES2/AES) e cai
 * para o leitor legado (node-forge, TripleDES) em caso de falha estrutural.
 * Senha errada NÃO dispara fallback.
 */
export async function readPfx(pfxBase64: string, password: string): Promise<PfxBundle> {
  // Sanity: detectar PEM disfarçado
  if (/-----BEGIN /.test(pfxBase64)) {
    throw new PfxError(
      "NOT_PFX",
      "Arquivo está em formato PEM, não PKCS#12 (.pfx)",
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(pfxBase64);
  } catch {
    throw new PfxError("CORRUPT", "Conteúdo base64 inválido");
  }

  if (bytes.length < 4 || bytes[0] !== 0x30) {
    // Todo PFX começa com SEQUENCE (0x30)
    throw new PfxError("NOT_PFX", "Arquivo não tem assinatura de PKCS#12 (.pfx)");
  }

  console.log("[pfx-reader] Iniciando leitura", {
    size: bytes.length,
    firstBytes: Array.from(bytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" "),
  });

  // 1) Tenta moderno (PKI.js)
  try {
    const result = await readPfxWithPkijs(bytes, password);
    console.log("[pfx-reader] OK via pkijs", { cn: result.cn, cnpj: result.cnpj });
    return result;
  } catch (modernErr) {
    const code = modernErr instanceof PfxError ? modernErr.code : classifyError(modernErr);
    console.warn("[pfx-reader] pkijs falhou", {
      code,
      message: String((modernErr as any)?.message ?? modernErr),
    });

    // Senha errada → não tenta forge (mesma senha vai falhar igual)
    if (code === "WRONG_PASSWORD") {
      throw new PfxError("WRONG_PASSWORD", "Senha do certificado incorreta");
    }
    // PEM detectado, ASN corrompido óbvio → também não vale tentar forge
    if (code === "NOT_PFX") {
      throw modernErr instanceof PfxError ? modernErr : new PfxError("NOT_PFX", String((modernErr as any).message));
    }

    // 2) Fallback para forge (TripleDES e outros legados)
    try {
      const result = await readPfxWithForge(bytes, password);
      console.log("[pfx-reader] OK via forge (fallback)", { cn: result.cn, cnpj: result.cnpj });
      return result;
    } catch (legacyErr) {
      const legacyCode = legacyErr instanceof PfxError
        ? legacyErr.code
        : classifyError(legacyErr);
      console.error("[pfx-reader] forge também falhou", {
        code: legacyCode,
        message: String((legacyErr as any)?.message ?? legacyErr),
      });

      if (legacyCode === "WRONG_PASSWORD") {
        throw new PfxError("WRONG_PASSWORD", "Senha do certificado incorreta");
      }
      // Se moderno deu UNSUPPORTED e legado também não abriu → cifra realmente desconhecida
      if (code === "UNSUPPORTED_CIPHER" || legacyCode === "UNSUPPORTED_CIPHER") {
        throw new PfxError(
          "UNSUPPORTED_CIPHER",
          "Formato de criptografia do certificado não é suportado",
        );
      }
      if (legacyCode === "MISSING_KEY" || legacyCode === "MISSING_CERT") {
        throw legacyErr;
      }
      throw new PfxError("CORRUPT", "Arquivo de certificado inválido ou corrompido");
    }
  }
}

/**
 * Traduz um PfxError para mensagem amigável em PT-BR para o usuário final.
 */
export function pfxErrorToUserMessage(err: unknown): string {
  const code: PfxErrorCode = err instanceof PfxError ? err.code : "UNKNOWN";
  switch (code) {
    case "WRONG_PASSWORD":
      return "Senha do certificado incorreta. Verifique a senha e tente novamente.";
    case "NOT_PFX":
      return "O arquivo enviado não é um certificado .pfx válido. Reexporte como PKCS#12 (.pfx) com senha e tente novamente.";
    case "CORRUPT":
      return "Arquivo de certificado inválido ou corrompido. Reexporte o .pfx e tente novamente.";
    case "UNSUPPORTED_CIPHER":
      return "O formato de criptografia deste certificado não é reconhecido pela plataforma. Solicite ao emissor um arquivo .pfx padrão (PBES2/AES ou TripleDES).";
    case "MISSING_KEY":
      return "O arquivo .pfx não contém uma chave privada utilizável.";
    case "MISSING_CERT":
      return "O arquivo .pfx não contém um certificado utilizável.";
    default:
      return "Não foi possível abrir o certificado. Verifique se o arquivo é um .pfx válido e se a senha está correta.";
  }
}
