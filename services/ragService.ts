import { UploadedFile } from '../types';

declare const pdfjsLib: any;
declare const mammoth: any;

export const chunkText = (text: string): string[] => {
  const normalizedText = text.replace(/\s\s+/g, ' ').trim();
  
  // Tenta dividir por artigos de lei primeiro
  const articles = normalizedText.split(/(Art\.\s\d+º?\.?)/).slice(1);
  if (articles.length > 2) { // Heurística para verificar se a divisão por artigo funcionou
    const chunks = [];
    for (let i = 0; i < articles.length; i += 2) {
      chunks.push((articles[i] + articles[i + 1]).trim());
    }
    return chunks.filter(c => c.length > 10);
  }

  // Fallback para divisão por parágrafos
  return text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 10);
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'UTF-8');
  });
};

const getTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const getTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return fullText;
};

export const processSingleUploadedFile = async (
  file: File,
  existingFileNames: string[]
): Promise<UploadedFile> => {
  if (existingFileNames.includes(file.name)) {
    throw new Error('Ficheiro já existe.');
  }

  try {
    let text: string;
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
      text = await readFileAsArrayBuffer(file).then(getTextFromPdf);
    } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith('.docx')) {
      text = await readFileAsArrayBuffer(file).then(getTextFromDocx);
    } else if (fileType === "text/plain" || fileName.endsWith('.txt')) {
      text = await readTextFile(file);
    } else {
      throw new Error(`Formato não suportado`);
    }

    if (!text || text.trim().length === 0) {
        throw new Error('Ficheiro vazio ou ilegível.');
    }

    const chunks = chunkText(text);
    return {
      name: file.name,
      chunks,
      selected: true
    };
  } catch (error: any) {
    console.error(`Erro ao processar o ficheiro ${file.name}:`, error);
    throw new Error(error.message || `Não foi possível ler o ficheiro.`);
  }
};