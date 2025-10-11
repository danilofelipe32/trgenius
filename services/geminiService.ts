import { GoogleGenAI } from "@google/genai";

// API key has been hardcoded for testing purposes on Netlify.
const apiKey = "AIzaSyB1SGptDVNzOh888rzlNSkXCiT5P2goNo0";
const ai = new GoogleGenAI({ apiKey: apiKey });

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
    return `Erro: Falha na comunicação com a API. Verifique a sua ligação à Internet. Detalhes: ${error.message}`;
  }
}