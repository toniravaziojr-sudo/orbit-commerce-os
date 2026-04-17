import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { getCredential } from "../_shared/platform-credentials.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const VERSION = "4.0.0"; // + AI Memory (long-term + conversation summaries)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMode = "chat" | "thinking" | "search";

interface Attachment {
  url: string;
  filename: string;
  mimeType: string;
}

interface ProcessedAttachment extends Attachment {
  extractedText?: string;
  transcription?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const { messages, hasAttachments, mode = "chat", attachments = [], tenant_id, user_id, conversation_id } = await req.json();
    
    console.log(`[v${VERSION}] ChatGPT request - mode: ${mode}, messages: ${messages?.length}, attachments: ${attachments?.length || 0}`);

    // Fetch memory context if tenant_id and user_id are available
    let memoryContext = "";
    if (tenant_id && user_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        memoryContext = await getMemoryContext(supabase, tenant_id, user_id, "chatgpt");
        if (memoryContext) console.log(`[v${VERSION}] Memory context loaded (${memoryContext.length} chars)`);
      } catch (e) {
        console.error(`[v${VERSION}] Memory fetch error:`, e);
      }
    }

    // Pre-process: Extract URLs from the last user message for chat mode
    let urlContext = "";
    if (mode === "chat") {
      const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
      const messageText = extractTextFromMessage(lastUserMessage);
      const urls = extractUrls(messageText);
      
      if (urls.length > 0) {
        console.log("Detected URLs to scrape:", urls);
        urlContext = await scrapeUrls(urls);
      }
    }

    // Pre-process attachments (documents and audio)
    let processedAttachments: ProcessedAttachment[] = [];
    if (attachments && attachments.length > 0) {
      processedAttachments = await processAttachments(attachments);
    }

    // Build enhanced messages with processed content
    const enhancedMessages = enhanceMessagesWithContext(messages, urlContext, processedAttachments);

    // Route based on mode
    if (mode === "search") {
      return await handleSearchMode(enhancedMessages, memoryContext);
    } else if (mode === "thinking") {
      return await handleThinkingMode(enhancedMessages, memoryContext);
    } else {
      return await handleChatMode(enhancedMessages, hasAttachments, urlContext, processedAttachments, memoryContext);
    }
  } catch (error) {
    console.error("ChatGPT chat error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

// =============================================
// URL EXTRACTION AND SCRAPING
// =============================================

function extractTextFromMessage(message: any): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join(" ");
  }
  return "";
}

function extractUrls(text: string): string[] {
  // Match URLs but exclude common file extensions that are attachments
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  
  // Filter out image/media URLs that are likely attachments
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mp3', '.wav', '.ogg', '.m4a'];
  
  return matches.filter(url => {
    const lowerUrl = url.toLowerCase();
    return !mediaExtensions.some(ext => lowerUrl.includes(ext));
  }).slice(0, 3); // Limit to 3 URLs max
}

async function scrapeUrls(urls: string[]): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    console.warn("FIRECRAWL_API_KEY not configured, skipping URL scraping");
    return "";
  }

  const results: string[] = [];

  for (const url of urls) {
    try {
      console.log(`Scraping URL: ${url}`);
      
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 15000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.data?.markdown || data.markdown || "";
        const title = data.data?.metadata?.title || data.metadata?.title || url;
        
        if (content) {
          // Limit content to ~4000 chars to avoid token limits
          const truncatedContent = content.length > 4000 
            ? content.substring(0, 4000) + "\n\n[...conteúdo truncado...]"
            : content;
            
          results.push(`## 📄 Conteúdo de: ${title}\n**URL:** ${url}\n\n${truncatedContent}`);
        }
      } else {
        console.error(`Failed to scrape ${url}: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }

  if (results.length > 0) {
    return `\n\n---\n\n# 🔗 Conteúdo Extraído das URLs\n\n${results.join("\n\n---\n\n")}`;
  }

  return "";
}

// =============================================
// ATTACHMENT PROCESSING (Documents & Audio)
// =============================================

async function processAttachments(attachments: Attachment[]): Promise<ProcessedAttachment[]> {
  const processed: ProcessedAttachment[] = [];

  for (const att of attachments) {
    const result: ProcessedAttachment = { ...att };

    // Process documents (PDF, DOC, etc.)
    if (isDocumentFile(att.mimeType, att.filename)) {
      console.log(`Processing document: ${att.filename}`);
      result.extractedText = await extractDocumentText(att);
    }
    
    // Process audio files
    if (att.mimeType.startsWith("audio/")) {
      console.log(`Processing audio: ${att.filename}`);
      result.transcription = await transcribeAudio(att);
    }

    processed.push(result);
  }

  return processed;
}

function isDocumentFile(mimeType: string, filename: string): boolean {
  const docMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ];
  
  const docExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv"];
  
  return docMimeTypes.includes(mimeType) || 
    docExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

async function extractDocumentText(attachment: Attachment): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  // For text files, fetch directly
  if (attachment.mimeType === "text/plain" || attachment.mimeType === "text/csv") {
    try {
      const response = await fetch(attachment.url);
      if (response.ok) {
        const text = await response.text();
        return text.length > 8000 
          ? text.substring(0, 8000) + "\n\n[...conteúdo truncado...]"
          : text;
      }
    } catch (error) {
      console.error("Error fetching text file:", error);
    }
    return "";
  }

  // For PDFs and other documents, use Firecrawl if available
  if (FIRECRAWL_API_KEY && attachment.mimeType === "application/pdf") {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: attachment.url,
          formats: ["markdown"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.data?.markdown || data.markdown || "";
        return content.length > 8000 
          ? content.substring(0, 8000) + "\n\n[...conteúdo truncado...]"
          : content;
      }
    } catch (error) {
      console.error("Error extracting PDF text:", error);
    }
  }

  // Fallback: indicate document was attached but not processed
  return `[Documento anexado: ${attachment.filename} - formato ${attachment.mimeType}]`;
}

async function transcribeAudio(attachment: Attachment): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY = await getCredential(supabaseUrl, supabaseServiceKey, "OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured, skipping audio transcription");
    return "[Áudio anexado - transcrição não disponível]";
  }

  try {
    // Download audio file
    const audioResponse = await fetch(attachment.url);
    if (!audioResponse.ok) {
      console.error(`Failed to download audio: ${audioResponse.status}`);
      return "[Erro ao baixar áudio]";
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Determine file extension
    let extension = "ogg";
    if (attachment.mimeType.includes("mpeg") || attachment.filename.endsWith(".mp3")) {
      extension = "mp3";
    } else if (attachment.mimeType.includes("wav") || attachment.filename.endsWith(".wav")) {
      extension = "wav";
    } else if (attachment.mimeType.includes("m4a") || attachment.filename.endsWith(".m4a")) {
      extension = "m4a";
    } else if (attachment.mimeType.includes("webm") || attachment.filename.endsWith(".webm")) {
      extension = "webm";
    }

    // Call OpenAI Whisper
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer]), `audio.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Audio transcribed: ${data.text?.substring(0, 100)}...`);
      return data.text || "[Áudio vazio]";
    } else {
      const errorText = await response.text();
      console.error("Whisper API error:", response.status, errorText);
      return "[Erro na transcrição]";
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "[Erro na transcrição]";
  }
}

// =============================================
// MESSAGE ENHANCEMENT
// =============================================

function enhanceMessagesWithContext(
  messages: any[],
  urlContext: string,
  processedAttachments: ProcessedAttachment[]
): any[] {
  if (!urlContext && processedAttachments.length === 0) {
    return messages;
  }

  // Build additional context
  let additionalContext = "";

  // Add URL content
  if (urlContext) {
    additionalContext += urlContext;
  }

  // Add document extracts
  const documentsWithText = processedAttachments.filter(a => a.extractedText);
  if (documentsWithText.length > 0) {
    additionalContext += "\n\n---\n\n# 📑 Conteúdo dos Documentos Anexados\n\n";
    for (const doc of documentsWithText) {
      additionalContext += `## ${doc.filename}\n\n${doc.extractedText}\n\n---\n\n`;
    }
  }

  // Add audio transcriptions
  const audiosWithTranscription = processedAttachments.filter(a => a.transcription);
  if (audiosWithTranscription.length > 0) {
    additionalContext += "\n\n---\n\n# 🎤 Transcrições de Áudio\n\n";
    for (const audio of audiosWithTranscription) {
      additionalContext += `## ${audio.filename}\n\n> "${audio.transcription}"\n\n---\n\n`;
    }
  }

  // Append context to the last user message
  return messages.map((msg, idx) => {
    if (idx === messages.length - 1 && msg.role === "user" && additionalContext) {
      if (typeof msg.content === "string") {
        return {
          ...msg,
          content: msg.content + additionalContext,
        };
      } else if (Array.isArray(msg.content)) {
        // Find text content and append
        const newContent = msg.content.map((c: any) => {
          if (c.type === "text") {
            return { ...c, text: c.text + additionalContext };
          }
          return c;
        });
        return { ...msg, content: newContent };
      }
    }
    return msg;
  });
}

// =============================================
// CHAT MODES
// =============================================

async function handleChatMode(
  messages: any[], 
  hasAttachments?: boolean,
  urlContext?: string,
  processedAttachments?: ProcessedAttachment[],
  memoryContext?: string
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const hasImageContent = messages?.some((m: any) => {
    if (Array.isArray(m.content)) {
      return m.content.some((c: any) => c.type === "image_url");
    }
    return false;
  });

  const model = hasImageContent ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";
  
  // Build enhanced system prompt based on what was processed
  let systemAdditions = "";
  if (urlContext) {
    systemAdditions += "\n- Você tem acesso ao conteúdo de URLs que o usuário compartilhou. Analise esse conteúdo para responder.";
  }
  if (processedAttachments?.some(a => a.extractedText)) {
    systemAdditions += "\n- Você recebeu o conteúdo extraído de documentos anexados. Use essas informações para responder.";
  }
  if (processedAttachments?.some(a => a.transcription)) {
    systemAdditions += "\n- Você recebeu transcrições de áudios anexados. Considere essas transcrições na sua resposta.";
  }
  
  console.log(`Chat mode - Model: ${model}, hasImages: ${hasImageContent}, hasUrlContext: ${!!urlContext}, processedDocs: ${processedAttachments?.filter(a => a.extractedText).length || 0}, processedAudios: ${processedAttachments?.filter(a => a.transcription).length || 0}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `Você é um assistente de IA altamente capaz e prestativo, similar ao ChatGPT.

Suas capacidades incluem:
- Responder perguntas sobre qualquer assunto
- Ajudar com pesquisas e análises
- Gerar textos, resumos e conteúdo
- Auxiliar com cálculos e lógica
- Fornecer explicações claras e detalhadas
- Ajudar com programação e código
- Traduzir textos entre idiomas
- Analisar imagens quando enviadas
- Ler e analisar conteúdo de URLs/links compartilhados
- Processar e analisar documentos (PDF, DOC, TXT, etc.)
- Transcrever e entender áudios${systemAdditions}

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- SEMPRE use formatação Markdown nas suas respostas
- Use ## ou ### para títulos de seções
- Use **texto** para destacar informações importantes
- Use listas com - ou números (1., 2., 3.) para listar itens
- Separe seções com linhas em branco
- Use \`código\` para termos técnicos inline
- Use blocos de código com \`\`\` para exemplos de código
- Organize a resposta de forma hierárquica e visualmente clara

Diretrizes:
- Seja conciso mas completo nas respostas
- Se não souber algo, diga honestamente
- Mantenha um tom profissional mas amigável
- Responda sempre no idioma da pergunta do usuário${memoryContext || ""}`,
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    return handleAIError(response);
  }

  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

async function handleThinkingMode(messages: any[], memoryContext?: string) {
  const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_API_KEY = await getCredential(supabaseUrl2, supabaseServiceKey2, "OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  console.log("Thinking mode - Using OpenAI o3-mini for reasoning");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de IA especializado em raciocínio profundo e resolução de problemas complexos.

Suas capacidades especiais:
- Raciocínio em cadeia (chain-of-thought)
- Análise multi-etapas de problemas complexos
- Decomposição de problemas em partes menores
- Verificação lógica de conclusões
- Matemática avançada e lógica formal

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- SEMPRE use formatação Markdown nas suas respostas
- Use ## para títulos de seções
- Use **texto** para destacar pontos importantes
- Mostre seu raciocínio passo a passo
- Use listas numeradas para etapas de raciocínio
- Separe análise de conclusão claramente

Diretrizes:
- Pense cuidadosamente antes de responder
- Mostre seu processo de raciocínio
- Verifique sua lógica
- Admita incertezas quando existirem
- Responda no idioma da pergunta${memoryContext || ""}`,
        },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    
    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "OpenAI API error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

async function handleSearchMode(messages: any[], memoryContext?: string) {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured. Please enable the Firecrawl connector.");
  }
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
  const query = extractTextFromMessage(lastUserMessage);

  console.log("Search mode - Query:", query);

  // Search the web
  const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error("Firecrawl search error:", searchResponse.status, errorText);
    throw new Error("Failed to search the web");
  }

  const searchResults = await searchResponse.json();
  console.log("Search results count:", searchResults.data?.length || 0);

  const searchContext = searchResults.data?.map((result: any, idx: number) => {
    return `## Fonte ${idx + 1}: ${result.title || "Sem título"}
URL: ${result.url}

${result.markdown || result.description || "Sem conteúdo disponível"}

---`;
  }).join("\n\n") || "Nenhum resultado encontrado.";

  const synthesisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um assistente de pesquisa que analisa resultados de busca na internet e sintetiza respostas precisas e bem fundamentadas.

## REGRAS OBRIGATÓRIAS:
1. Use APENAS as informações fornecidas nos resultados de busca
2. Cite as fontes no texto usando [Fonte 1], [Fonte 2], etc.
3. Se os resultados não contiverem a informação, diga claramente
4. Use formatação Markdown rica para organizar a resposta
5. **SEMPRE inclua a seção "## 🔗 Fontes Consultadas" no final com os links clicáveis**
6. Seja objetivo e factual
7. Responda no idioma da pergunta

## FORMATO DA RESPOSTA (siga exatamente):

## 📋 Resumo

[Síntese principal da informação encontrada em 2-3 parágrafos]

---

## 📌 Detalhes

[Informações organizadas por tópico com subtítulos ### quando necessário]

- Use listas para facilitar a leitura
- Destaque pontos importantes com **negrito**
- Cite as fontes relevantes [Fonte 1], [Fonte 2], etc.

---

## 🔗 Fontes Consultadas

1. [Título da Fonte 1](URL_COMPLETA_1)
2. [Título da Fonte 2](URL_COMPLETA_2)
3. [Título da Fonte 3](URL_COMPLETA_3)

**IMPORTANTE**: A seção de fontes é OBRIGATÓRIA e deve conter links clicáveis no formato Markdown.`,
        },
        {
          role: "user",
          content: `**Pergunta do usuário:** "${query}"

---

## RESULTADOS DA BUSCA NA WEB:

${searchContext}

---

**Instruções:** Com base nos resultados acima, responda à pergunta do usuário de forma completa e precisa. Lembre-se de incluir a seção de fontes com links clicáveis no final.`,
        },
      ],
      stream: true,
    }),
  });

  if (!synthesisResponse.ok) {
    return handleAIError(synthesisResponse);
  }

  return new Response(synthesisResponse.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
    },
  });
}

async function handleAIError(response: Response) {
  console.error("AI gateway error:", response.status, await response.text());
  
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "Payment required, please add funds." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  return new Response(
    JSON.stringify({ error: "AI gateway error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
