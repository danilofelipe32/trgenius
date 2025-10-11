
export interface Section {
  id: string;
  title: string;
  placeholder: string;
  hasGen: boolean;
  hasRiskAnalysis?: boolean;
}

export interface DocumentSection {
  [key: string]: string;
}

export interface SavedDocument {
  id: number;
  name: string;
  createdAt: string;
  sections: DocumentSection;
}

export type DocumentType = 'etp' | 'tr';

export interface FileChunk {
  page: number;
  content: string;
}

export interface UploadedFile {
  name: string;
  chunks: string[];
  selected: boolean;
}

export interface PreviewContext {
  type: DocumentType | null;
  id: number | null;
}
