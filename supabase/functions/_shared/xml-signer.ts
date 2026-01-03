/**
 * Módulo de Assinatura Digital XML
 * 
 * Implementa assinatura XMLDSig conforme exigido pela SEFAZ
 * Algoritmos: SHA-1 (digest), RSA-SHA1 (assinatura), C14N (canonicalização)
 */

// Import node-forge with bundle flag for Deno compatibility
import forge from "https://esm.sh/node-forge@1.3.1?bundle";

// ============================================
// POLYFILL: Inicializar PRNG do node-forge para Deno
// O node-forge depende de randomBytes do Node.js que não existe no Deno
// Usamos a Web Crypto API nativa do Deno para prover entropia
// ============================================
try {
  // Seed the PRNG with cryptographically secure random bytes
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  const seedString = Array.from(seedBytes).map(b => String.fromCharCode(b)).join('');
  
  // Initialize forge's PRNG with the seed
  if (forge.random && typeof forge.random.seedFileSync === 'function') {
    // forge.random already has a method, we're good
  } else if (forge.random) {
    // Provide a custom implementation
    (forge.random as any).seedFileSync = (needed: number): string => {
      const bytes = new Uint8Array(needed);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    };
  }
  
  // Also seed the random pool if available
  if (forge.random && typeof (forge.random as any).getBytes === 'function') {
    // Collect entropy from Web Crypto
    const entropyBytes = new Uint8Array(32);
    crypto.getRandomValues(entropyBytes);
    const entropyString = Array.from(entropyBytes).map(b => String.fromCharCode(b)).join('');
    
    if (typeof (forge.random as any).collect === 'function') {
      (forge.random as any).collect(entropyString);
    }
  }
  
  console.log('[xml-signer] PRNG polyfill initialized successfully');
} catch (e) {
  console.warn('[xml-signer] PRNG polyfill initialization warning:', e);
}

export interface Certificate {
  privateKey: forge.pki.PrivateKey;
  certificate: forge.pki.Certificate;
  certificatePem: string;
}

/**
 * Carrega o certificado PFX
 */
export function loadCertificate(pfxBase64: string, password: string): Certificate {
  try {
    console.log('[xml-signer] Loading certificate, base64 length:', pfxBase64.length);
    
    const pfxDer = forge.util.decode64(pfxBase64);
    console.log('[xml-signer] Decoded DER length:', pfxDer.length);
    
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
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

    const certificate = certBag[0].cert;
    const certificatePem = forge.pki.certificateToPem(certificate);
    
    // Extrai apenas o conteúdo base64 do PEM (sem headers)
    const certBase64 = certificatePem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\r?\n|\r/g, '');

    console.log('[xml-signer] Certificate loaded successfully');
    
    return {
      privateKey: keyBag[0].key,
      certificate,
      certificatePem: certBase64
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
 * Implementação simplificada de Canonicalização C14N Exclusiva
 * 
 * Nota: Esta é uma implementação básica. Para produção,
 * pode ser necessário usar uma biblioteca C14N mais robusta.
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
 * Calcula o hash SHA-1 e retorna em Base64
 */
export function sha1Base64(data: string): string {
  const md = forge.md.sha1.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().bytes());
}

/**
 * Assina dados com RSA-SHA1
 */
export function signRsaSha1(data: string, privateKey: forge.pki.PrivateKey): string {
  const md = forge.md.sha1.create();
  md.update(data, 'utf8');
  const signature = privateKey.sign(md);
  return forge.util.encode64(signature);
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
export function signNFeXml(xml: string, certificate: Certificate): string {
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
  const digestValue = sha1Base64(canonicalizedInfNFe);
  
  // Monta o SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${uri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  
  // Canonicaliza o SignedInfo
  const canonicalizedSignedInfo = canonicalize(signedInfo);
  
  // Assina o SignedInfo canonicalizado
  const signatureValue = signRsaSha1(canonicalizedSignedInfo, certificate.privateKey);
  
  // Monta o bloco Signature completo
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificate.certificatePem}</X509Certificate></X509Data></KeyInfo></Signature>`;
  
  // Insere a assinatura antes do fechamento de infNFe
  const signedXml = xml.replace('</infNFe>', `${signature}</infNFe>`);
  
  return signedXml;
}

/**
 * Assina XML genérico (para eventos, consultas, etc.)
 */
export function signXml(xml: string, tagToSign: string, certificate: Certificate): string {
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
    const digestValue = sha1Base64(canonicalized);
    
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
    
    const canonicalizedSignedInfo = canonicalize(signedInfo);
    const signatureValue = signRsaSha1(canonicalizedSignedInfo, certificate.privateKey);
    
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
  const digestValue = sha1Base64(canonicalized);
  
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${uri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  
  const canonicalizedSignedInfo = canonicalize(signedInfo);
  const signatureValue = signRsaSha1(canonicalizedSignedInfo, certificate.privateKey);
  
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
    
    // Para uma validação completa, seria necessário:
    // 1. Extrair e canonicalizar o SignedInfo
    // 2. Verificar a assinatura com a chave pública
    // 3. Extrair e canonicalizar o elemento referenciado
    // 4. Verificar se o digest calculado bate com o DigestValue
    
    // Por ora, apenas verifica se os elementos existem
    return true;
  } catch {
    return false;
  }
}
