import { GoogleGenAI } from "@google/genai";

// Chave de API do Gemini para fins de teste, conforme solicitado.
const API_KEY = "AIzaSyB1SGptDVNzOh888rzlNSkXCiT5P2goNo0";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function callGemini(prompt: string): Promise<string> {
  try {
    // Conforme as diretrizes, usar gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    // Conforme as diretrizes, a forma mais simples de obter o texto é response.text
    const text = response.text;
    
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

    if (errorMessage.includes('API key not valid')) {
        return `Erro: A chave de API do Gemini fornecida não é válida. Verifique a chave no arquivo services/geminiService.ts.`;
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