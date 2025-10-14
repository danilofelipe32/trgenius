import { GoogleGenAI } from "@google/genai";

// APLICAÇÃO EM FASE DE TESTES: Mantenha a chave aqui, conforme solicitado.
// Para produção, mova para uma variável de ambiente (process.env.API_KEY).
const API_KEY = "COLOQUE_SUA_CHAVE_API_AQUI";

if (API_KEY === "COLOQUE_SUA_CHAVE_API_AQUI") {
  console.warn("Chave de API do Gemini não configurada. Substitua o placeholder em services/geminiService.ts.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function callGemini(prompt: string): Promise<string> {
  try {
    // Per guidelines, use gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    // Per guidelines, the simplest way to get text is response.text
    const text = response.text;
    
    // The original implementation had a check for safety finish reason.
    if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'SAFETY') {
      return "Erro: A resposta foi bloqueada devido a configurações de segurança. O seu prompt pode conter conteúdo sensível.";
    }

    if (text) {
      return text;
    }
    
    return "Erro: A resposta da API não continha texto gerado. Verifique o seu prompt.";

  } catch (error: any) {
    console.error("Erro ao chamar a API Gemini:", error);

    const errorMessage = error.message || '';

    if (errorMessage.includes('API key not valid') || API_KEY === "COLOQUE_SUA_CHAVE_API_AQUI") {
        return `Erro: A chave de API do Gemini não é válida ou não foi configurada. Por favor, edite o ficheiro 'services/geminiService.ts' e substitua o valor da constante 'API_KEY' pela sua chave.`;
    }
    
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        const retryMatch = errorMessage.match(/retryDelay": "(\d+\.?\d*)s"/);
        let retryMessage = "Por favor, tente novamente mais tarde.";
        if (retryMatch && retryMatch[1]) {
            const delay = Math.ceil(parseFloat(retryMatch[1]));
            retryMessage = ` Por favor, aguarde cerca de ${delay} segundos antes de tentar novamente.`;
        }
        return `Erro: Limite de utilização da API excedido (cota). Você fez muitas solicitações num curto espaço de tempo.${retryMessage} Se o problema persistir, verifique o seu plano de faturação da API Gemini.`;
    }

    return `Erro: Falha na comunicação com a API. Verifique a sua ligação à Internet. Detalhes: ${errorMessage}`;
  }
}