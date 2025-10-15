import { GoogleGenAI } from "@google/genai";

// Chave de API do Gemini para fins de teste, conforme solicitado.
const API_KEY = "AIzaSyB1SGptDVNzOh888rzlNSkXCiT5P2goNo0";
if (!API_KEY) {
  throw new Error("API_KEY do Gemini não encontrada. Verifique a configuração.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Função base para chamadas à API, com tratamento de erro genérico
async function callGeminiAPI(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      ...(systemInstruction && { config: { systemInstruction } })
    });
    
    if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'SAFETY') {
      return "Erro: A resposta foi bloqueada devido a configurações de segurança. O seu prompt pode conter conteúdo sensível.";
    }

    const text = response.text;
    if (text) {
      return text;
    }
    
    return "Erro: A resposta da API não continha texto gerado. Verifique o seu prompt.";

  } catch (error: any) {
    console.error("Erro ao chamar a API Gemini:", error);
    const errorMessage = error.message || String(error);

    if (errorMessage.includes('API key not valid')) {
        return `Erro: A chave de API do Gemini fornecida não é válida. Verifique a chave no arquivo services/geminiService.ts.`;
    }
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return `Erro: Limite de utilização da API excedido (cota). Você fez muitas solicitações num curto espaço de tempo. Por favor, tente novamente mais tarde.`;
    }
    return `Erro: Falha na comunicação com a API. Verifique a sua ligação à Internet. Detalhes: ${errorMessage}`;
  }
}

// Otimização: Prompts mais detalhados e uso de Instrução de Sistema

const ETP_SYSTEM_INSTRUCTION = `Você é um especialista sênior em planeamento de contratações públicas no Brasil, com profundo conhecimento da Lei 14.133/21. Sua tarefa é gerar conteúdo para seções de um Estudo Técnico Preliminar (ETP). Responda de forma técnica, clara, objetiva e bem estruturada, utilizando parágrafos curtos, listas (bullet points) e negrito para destacar termos importantes. Sempre que possível, fundamente suas respostas com referências à Lei 14.133/21. Retorne apenas o conteúdo solicitado para a seção, sem cabeçalhos ou introduções como "Aqui está o texto para a seção...".`;

export async function generateEtpSection(sectionTitle: string, context: string, ragContext: string): Promise<string> {
  const prompt = `Gere o conteúdo para a seção "${sectionTitle}" de um Estudo Técnico Preliminar (ETP).

Utilize as seguintes informações como base:
--- INÍCIO DO CONTEXTO DO FORMULÁRIO ---
${context}
--- FIM DO CONTEXTO DO FORMULÁRIO ---

${ragContext ? `--- INÍCIO DOS DOCUMENTOS DE APOIO (RAG) ---\n${ragContext}\n--- FIM DOS DOCUMENTOS DE APOIO (RAG) ---` : ''}

Requisitos da Resposta:
- O texto deve ser detalhado e tecnicamente correto.
- Deve ser formatado para fácil leitura em um documento oficial.
- Incorpore as informações do formulário e dos documentos de apoio de forma coesa.

Conteúdo para a seção "${sectionTitle}":`;
  return callGeminiAPI(prompt, ETP_SYSTEM_INSTRUCTION);
}


const TR_SYSTEM_INSTRUCTION = `Você é um especialista sênior em licitações e contratos públicos no Brasil, com profundo conhecimento da Lei 14.133/21. Sua tarefa é gerar conteúdo para seções de um Termo de Referência (TR). Responda de forma técnica, clara, objetiva e bem estruturada, utilizando parágrafos curtos, listas (bullet points) e negrito para destacar termos importantes. Sempre que possível, fundamente suas respostas com referências aos artigos da Lei 14.133/21. Retorne apenas o conteúdo solicitado para a seção, sem cabeçalhos ou introduções.`;

export async function generateTrSection(sectionTitle: string, context: string, ragContext: string): Promise<string> {
    const prompt = `Gere o conteúdo para a seção "${sectionTitle}" de um Termo de Referência (TR).

Utilize as seguintes fontes de informação, em ordem de prioridade:
1.  O Estudo Técnico Preliminar (ETP) base.
2.  Os documentos de apoio (RAG) fornecidos.
3.  O conteúdo já preenchido em outras seções do TR.

--- INÍCIO DAS FONTES DE INFORMAÇÃO ---
${context}
${ragContext ? `\n${ragContext}` : ''}
--- FIM DAS FONTES DE INFORMAÇÃO ---

Requisitos da Resposta:
- O texto deve ser detalhado e bem fundamentado, extraindo e inferindo as informações necessárias das fontes fornecidas.
- A resposta deve ser formatada para fácil leitura em um documento oficial.

Conteúdo para a seção "${sectionTitle}":`;
    return callGeminiAPI(prompt, TR_SYSTEM_INSTRUCTION);
}


const RISK_ANALYSIS_SYSTEM_INSTRUCTION = `Você é um especialista sênior em gestão de riscos em contratações públicas no Brasil. Sua tarefa é realizar análises de risco detalhadas e construtivas. A resposta deve ser formatada em Markdown, usando títulos (##), listas e negrito para clareza.`;

export async function analyzeRisk(sectionTitle: string, sectionContent: string, primaryContext: string, ragContext: string, docType: string): Promise<string> {
    const prompt = `Realize uma análise de riscos para a seção "${sectionTitle}" de um ${docType.toUpperCase()}.

**Seção a ser analisada:**
${sectionContent}

**Contexto Adicional (Outras seções, ETP, etc.):**
${primaryContext}
${ragContext}

**Sua Tarefa:**
1.  **Identifique Riscos:** Liste de 3 a 5 riscos potenciais relacionados DIRETAMENTE ao conteúdo da seção analisada, considerando o contexto geral.
2.  **Classifique os Riscos:** Para cada risco, classifique a **Probabilidade** (Baixa, Média, Alta) e o **Impacto** (Baixo, Médio, Alto).
3.  **Sugira Medidas de Mitigação:** Para cada risco, proponha uma ou duas ações CONCRETAS para mitigar ou eliminar o risco.

**Formato da Resposta (use Markdown):**

## Risco 1: [Nome do Risco]
-   **Descrição:** [Explicação detalhada do risco]
-   **Probabilidade:** [Baixa/Média/Alta]
-   **Impacto:** [Baixo/Médio/Alto]
-   **Medidas de Mitigação:**
    -   [Ação 1]
    -   [Ação 2]

## Risco 2: [Nome do Risco]
... e assim por diante.`;
    return callGeminiAPI(prompt, RISK_ANALYSIS_SYSTEM_INSTRUCTION);
}

const REFINE_TEXT_SYSTEM_INSTRUCTION = `Você é um assistente de redação IA, especializado em aprimorar textos para documentos oficiais e licitatórios. Seu objetivo é seguir a instrução do usuário para refinar o texto fornecido, mantendo a clareza, a precisão técnica e a formalidade. Retorne APENAS o texto refinado, sem nenhuma introdução, observação ou formatação adicional que não tenha sido solicitada.`;

export async function refineText(originalText: string, refinePrompt: string): Promise<string> {
    const prompt = `Refine o texto a seguir com base na solicitação do usuário.

--- INÍCIO DO TEXTO ORIGINAL ---
${originalText}
--- FIM DO TEXTO ORIGINAL ---

**Solicitação do usuário:** "${refinePrompt}"

--- TEXTO REFINADO ---`;
    return callGeminiAPI(prompt, REFINE_TEXT_SYSTEM_INSTRUCTION);
}


const SUMMARY_SYSTEM_INSTRUCTION = `Você é um assistente executivo especializado em sintetizar informações complexas de documentos de licitações públicas. Crie resumos executivos concisos, diretos e focados nos pontos-chave.`;

export async function generateSummary(documentText: string, ragContext: string): Promise<string> {
    const prompt = `Crie um resumo executivo do "Documento Principal" a seguir. O resumo deve ser conciso (máximo de 200 palavras), focar APENAS nas informações do "Documento Principal" e destacar os seguintes pontos:
1.  O objetivo principal da contratação.
2.  Os elementos, requisitos ou especificações mais importantes.
3.  A conclusão ou solução recomendada.

Utilize os "Documentos de Apoio (RAG)" apenas como contexto para entender melhor o tema, sem citá-los no resumo.

--- INÍCIO DO DOCUMENTO PRINCIPAL ---
${documentText}
--- FIM DO DOCUMENTO PRINCIPAL ---

${ragContext}

--- RESUMO EXECUTIVO ---`;
    return callGeminiAPI(prompt, SUMMARY_SYSTEM_INSTRUCTION);
}

/**
 * @deprecated Use as funções especializadas (generateEtpSection, generateTrSection, etc.) para prompts otimizados.
 */
export async function callGemini(prompt: string): Promise<string> {
  console.warn("A função `callGemini` está obsoleta. Use as funções especializadas do geminiService.");
  return callGeminiAPI(prompt);
}
