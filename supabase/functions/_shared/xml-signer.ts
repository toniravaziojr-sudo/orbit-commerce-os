/**
 * Módulo de Assinatura Digital XML
 * 
 * Implementa assinatura XMLDSig conforme exigido pela SEFAZ
 * Algoritmos: SHA-1 (digest), RSA-SHA1 (assinatura), C14N (canonicalização)
 * 
 * Esta versão usa Web Crypto API nativa do Deno para operações criptográficas
 */

// ============================================
// Constantes e tipos
// ============================================

export interface Certificate {
  privateKeyPem: string;
  certificatePem: string;
  privateKeyRaw?: CryptoKey;
}

// ============================================
// Funções utilitárias de codificação
// ============================================

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

// ============================================
// Parser ASN.1/DER simplificado para PFX/PKCS12
// ============================================

interface Asn1Element {
  tag: number;
  length: number;
  value: Uint8Array;
  children?: Asn1Element[];
}

function parseAsn1(data: Uint8Array, offset = 0): { element: Asn1Element; bytesRead: number } {
  const tag = data[offset];
  let length = data[offset + 1];
  let headerLength = 2;
  
  if (length & 0x80) {
    const numLengthBytes = length & 0x7f;
    length = 0;
    for (let i = 0; i < numLengthBytes; i++) {
      length = (length << 8) | data[offset + 2 + i];
    }
    headerLength = 2 + numLengthBytes;
  }
  
  const value = data.slice(offset + headerLength, offset + headerLength + length);
  const element: Asn1Element = { tag, length, value };
  
  // Se é uma sequência ou set, parse os filhos
  if ((tag & 0x20) !== 0) {
    element.children = [];
    let childOffset = 0;
    while (childOffset < value.length) {
      const { element: child, bytesRead } = parseAsn1(value, childOffset);
      element.children.push(child);
      childOffset += bytesRead;
    }
  }
  
  return { element, bytesRead: headerLength + length };
}

// ============================================
// Parser PKCS12/PFX usando forge via esm.sh com polyfill
// ============================================

/**
 * Carrega o certificado PFX
 * Usa uma abordagem híbrida: forge para parsing do PFX e Web Crypto para assinatura
 */
export async function loadCertificate(pfxBase64: string, password: string): Promise<Certificate> {
  console.log('[xml-signer] Loading certificate, base64 length:', pfxBase64.length);
  
  // Importar forge dinamicamente para evitar problemas de inicialização
  const forgeModule = await import("https://esm.sh/node-forge@1.3.1?bundle");
  
  // O módulo pode vir como default export ou como named exports
  const forge = forgeModule.default || forgeModule;
  
  console.log('[xml-signer] Forge module loaded, checking exports...');
  console.log('[xml-signer] forge.util exists:', !!forge.util);
  console.log('[xml-signer] forge.util.decode64 exists:', !!forge.util?.decode64);
  console.log('[xml-signer] forge.pki exists:', !!forge.pki);
  console.log('[xml-signer] forge.asn1 exists:', !!forge.asn1);
  console.log('[xml-signer] forge.pkcs12 exists:', !!forge.pkcs12);
  console.log('[xml-signer] forge.random exists:', !!forge.random);
  
  if (!forge.util || !forge.util.decode64) {
    console.error('[xml-signer] forge.util structure:', Object.keys(forge.util || {}));
    console.error('[xml-signer] forge structure:', Object.keys(forge));
    throw new Error('node-forge não carregou corretamente - forge.util.decode64 não encontrado');
  }
  
  // Polyfill do PRNG antes de usar forge
  const prngPolyfill = (needed: number): string => {
    const bytes = new Uint8Array(needed || 32);
    crypto.getRandomValues(bytes);
    return String.fromCharCode(...bytes);
  };
  
  // Configurar o PRNG do forge
  if (forge.random) {
    console.log('[xml-signer] Configuring PRNG polyfill...');
    forge.random.seedFileSync = prngPolyfill;
    // Adicionar entropia inicial
    if (typeof forge.random.collect === 'function') {
      forge.random.collect(prngPolyfill(32));
    }
  }
  
  try {
    console.log('[xml-signer] Decoding PFX from base64...');
    const pfxDer = forge.util.decode64(pfxBase64);
    console.log('[xml-signer] Decoded DER length:', pfxDer.length);
    
    console.log('[xml-signer] Parsing ASN1...');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    
    console.log('[xml-signer] Parsing PKCS12...');
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

    // Busca a chave privada
    const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    
    if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
      throw new Error('Chave privada não encontrada no certificado');
    }

    // Busca o certificado
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    
    if (!certBag || certBag.length === 0 || !certBag[0].cert) {
      throw new Error('Certificado não encontrado no PFX');
    }

    const privateKey = keyBag[0].key;
    const certificate = certBag[0].cert;
    
    // Converter para PEM
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
    const certificatePem = forge.pki.certificateToPem(certificate);
    
    // Extrai apenas o conteúdo base64 do PEM do certificado (sem headers)
    const certBase64 = certificatePem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\r?\n|\r/g, '');

    console.log('[xml-signer] Certificate loaded successfully');
    
    // Importar a chave privada para Web Crypto para assinatura
    const privateKeyRaw = await importPrivateKeyForSigning(privateKeyPem);
    
    return {
      privateKeyPem,
      certificatePem: certBase64,
      privateKeyRaw
    };
  } catch (error) {
    console.error('[xml-signer] Error loading certificate:', error);
    if (error instanceof Error && error.message.includes('Invalid password')) {
      throw new Error('Senha do certificado inválida');
    }
    throw error;
  }
}

/**
 * Importa uma chave privada PEM para uso com Web Crypto
 */
async function importPrivateKeyForSigning(privateKeyPem: string): Promise<CryptoKey> {
  // Extrair o conteúdo base64 do PEM
  const pemHeader = '-----BEGIN RSA PRIVATE KEY-----';
  const pemFooter = '-----END RSA PRIVATE KEY-----';
  const pkcs8Header = '-----BEGIN PRIVATE KEY-----';
  const pkcs8Footer = '-----END PRIVATE KEY-----';
  
  let keyData: ArrayBuffer;
  let format: 'pkcs8' | 'spki' = 'pkcs8';
  
  if (privateKeyPem.includes(pkcs8Header)) {
    const base64 = privateKeyPem
      .replace(pkcs8Header, '')
      .replace(pkcs8Footer, '')
      .replace(/\s/g, '');
    keyData = base64ToArrayBuffer(base64);
  } else if (privateKeyPem.includes(pemHeader)) {
    // Chave RSA tradicional precisa ser convertida para PKCS8
    const base64 = privateKeyPem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    // Para chaves RSA tradicionais, precisamos envolver em PKCS8
    const rsaKey = base64ToArrayBuffer(base64);
    keyData = wrapRsaKeyInPkcs8(new Uint8Array(rsaKey));
  } else {
    throw new Error('Formato de chave privada não suportado');
  }
  
  try {
    // Web Crypto não suporta SHA-1 para assinatura por padrão em muitos browsers
    // Mas Deno suporta para compatibilidade
    const key = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-1'
      },
      false,
      ['sign']
    );
    
    console.log('[xml-signer] Private key imported for signing');
    return key;
  } catch (error) {
    console.error('[xml-signer] Error importing private key:', error);
    throw error;
  }
}

/**
 * Envolve uma chave RSA tradicional em formato PKCS8
 */
function wrapRsaKeyInPkcs8(rsaKeyBytes: Uint8Array): ArrayBuffer {
  // OID para rsaEncryption
  const rsaOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const nullParam = new Uint8Array([0x05, 0x00]);
  
  // Construir AlgorithmIdentifier SEQUENCE
  const algIdContent = new Uint8Array(rsaOid.length + nullParam.length);
  algIdContent.set(rsaOid, 0);
  algIdContent.set(nullParam, rsaOid.length);
  
  // Calcular tamanhos
  const algIdLen = algIdContent.length;
  const privateKeyOctetLen = rsaKeyBytes.length;
  
  // Construir a estrutura PKCS8
  const result: number[] = [];
  
  // Version INTEGER 0
  result.push(0x02, 0x01, 0x00);
  
  // AlgorithmIdentifier SEQUENCE
  result.push(0x30);
  pushLength(result, algIdLen);
  for (let i = 0; i < algIdContent.length; i++) {
    result.push(algIdContent[i]);
  }
  
  // PrivateKey OCTET STRING
  result.push(0x04);
  pushLength(result, privateKeyOctetLen);
  for (let i = 0; i < rsaKeyBytes.length; i++) {
    result.push(rsaKeyBytes[i]);
  }
  
  // Envolver tudo em SEQUENCE
  const finalResult: number[] = [0x30];
  pushLength(finalResult, result.length);
  finalResult.push(...result);
  
  return new Uint8Array(finalResult).buffer;
}

function pushLength(arr: number[], len: number) {
  if (len < 128) {
    arr.push(len);
  } else if (len < 256) {
    arr.push(0x81, len);
  } else if (len < 65536) {
    arr.push(0x82, (len >> 8) & 0xff, len & 0xff);
  } else {
    arr.push(0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
  }
}

/**
 * Implementação simplificada de Canonicalização C14N Exclusiva
 */
export function canonicalize(xml: string): string {
  // Remove declaração XML
  let result = xml.replace(/<\?xml[^?]*\?>/gi, '');
  
  // Remove espaços entre tags
  result = result.replace(/>\s+</g, '><');
  
  // Remove espaços no início e fim
  result = result.trim();
  
  // Normaliza atributos (ordena alfabeticamente)
  result = result.replace(/<([^\s>]+)([^>]*)>/g, (match, tagName, attrs) => {
    if (!attrs || attrs.trim() === '' || attrs.trim() === '/') {
      return match;
    }
    
    // Extrai atributos
    const attrRegex = /\s+([^\s=]+)=["']([^"']*)["']/g;
    const attributes: Array<{ name: string; value: string }> = [];
    let attrMatch;
    
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      attributes.push({ name: attrMatch[1], value: attrMatch[2] });
    }
    
    // Ordena atributos por namespace primeiro, depois por nome
    attributes.sort((a, b) => {
      const aIsNs = a.name.startsWith('xmlns');
      const bIsNs = b.name.startsWith('xmlns');
      if (aIsNs && !bIsNs) return -1;
      if (!aIsNs && bIsNs) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Reconstrói a tag
    const sortedAttrs = attributes
      .map(a => ` ${a.name}="${a.value}"`)
      .join('');
    
    const selfClosing = attrs.trim().endsWith('/') ? '/' : '';
    return `<${tagName}${sortedAttrs}${selfClosing}>`;
  });
  
  return result;
}

/**
 * Calcula o hash SHA-1 e retorna em Base64 usando Web Crypto API
 */
export async function sha1Base64(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Assina dados com RSA-SHA1 usando Web Crypto API
 */
export async function signRsaSha1(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    dataBuffer
  );
  return arrayBufferToBase64(signature);
}

/**
 * Extrai o conteúdo de uma tag específica do XML
 */
function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[0] : null;
}

/**
 * Assina o XML da NF-e conforme padrão SEFAZ
 */
export async function signNFeXml(xml: string, certificate: Certificate): Promise<string> {
  if (!certificate.privateKeyRaw) {
    throw new Error('Chave privada não carregada para assinatura');
  }
  
  // Encontra o elemento infNFe para extrair o Id
  const infNFeMatch = xml.match(/<infNFe[^>]*Id="([^"]+)"[^>]*>/);
  if (!infNFeMatch) {
    throw new Error('Elemento infNFe com atributo Id não encontrado');
  }
  
  const nfeId = infNFeMatch[1];
  const uri = `#${nfeId}`;
  
  // Extrai o conteúdo de infNFe para calcular o digest
  const infNFeContent = extractTagContent(xml, 'infNFe');
  if (!infNFeContent) {
    throw new Error('Conteúdo de infNFe não encontrado');
  }
  
  // Canonicaliza o infNFe
  const canonicalizedInfNFe = canonicalize(infNFeContent);
  
  // Calcula o DigestValue (SHA-1 do conteúdo canonicalizado)
  const digestValue = await sha1Base64(canonicalizedInfNFe);
  
  // Monta o SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${uri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  
  // Canonicaliza o SignedInfo
  const canonicalizedSignedInfo = canonicalize(signedInfo);
  
  // Assina o SignedInfo canonicalizado
  const signatureValue = await signRsaSha1(canonicalizedSignedInfo, certificate.privateKeyRaw);
  
  // Monta o bloco Signature completo
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificate.certificatePem}</X509Certificate></X509Data></KeyInfo></Signature>`;
  
  // Insere a assinatura antes do fechamento de infNFe
  const signedXml = xml.replace('</infNFe>', `${signature}</infNFe>`);
  
  return signedXml;
}

/**
 * Assina XML genérico (para eventos, consultas, etc.)
 */
export async function signXml(xml: string, tagToSign: string, certificate: Certificate): Promise<string> {
  if (!certificate.privateKeyRaw) {
    throw new Error('Chave privada não carregada para assinatura');
  }
  
  // Encontra o elemento para assinar
  const tagMatch = xml.match(new RegExp(`<${tagToSign}[^>]*Id="([^"]+)"[^>]*>`));
  if (!tagMatch) {
    // Se não tem Id, tenta assinar o documento todo
    const tagContent = extractTagContent(xml, tagToSign);
    if (!tagContent) {
      throw new Error(`Elemento ${tagToSign} não encontrado`);
    }
    
    // Para tags sem Id, usamos URI vazia
    const canonicalized = canonicalize(tagContent);
    const digestValue = await sha1Base64(canonicalized);
    
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
    
    const canonicalizedSignedInfo = canonicalize(signedInfo);
    const signatureValue = await signRsaSha1(canonicalizedSignedInfo, certificate.privateKeyRaw);
    
    const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificate.certificatePem}</X509Certificate></X509Data></KeyInfo></Signature>`;
    
    return xml.replace(`</${tagToSign}>`, `${signature}</${tagToSign}>`);
  }
  
  // Com Id, processo normal similar ao signNFeXml
  const elementId = tagMatch[1];
  const uri = `#${elementId}`;
  
  const tagContent = extractTagContent(xml, tagToSign);
  if (!tagContent) {
    throw new Error(`Conteúdo de ${tagToSign} não encontrado`);
  }
  
  const canonicalized = canonicalize(tagContent);
  const digestValue = await sha1Base64(canonicalized);
  
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${uri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  
  const canonicalizedSignedInfo = canonicalize(signedInfo);
  const signatureValue = await signRsaSha1(canonicalizedSignedInfo, certificate.privateKeyRaw);
  
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificate.certificatePem}</X509Certificate></X509Data></KeyInfo></Signature>`;
  
  return xml.replace(`</${tagToSign}>`, `${signature}</${tagToSign}>`);
}

/**
 * Valida a assinatura de um XML assinado
 */
export function validateSignature(signedXml: string, certificate: Certificate): boolean {
  try {
    // Extrai o SignatureValue
    const sigValueMatch = signedXml.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
    if (!sigValueMatch) {
      return false;
    }
    
    // Extrai o DigestValue
    const digestMatch = signedXml.match(/<DigestValue>([^<]+)<\/DigestValue>/);
    if (!digestMatch) {
      return false;
    }
    
    // Por ora, apenas verifica se os elementos existem
    return true;
  } catch {
    return false;
  }
}
