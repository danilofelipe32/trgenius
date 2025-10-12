import { SavedDocument, UploadedFile } from '../types';

const ETP_STORAGE_KEY = 'savedETPs';
const TR_STORAGE_KEY = 'savedTRs';
const FILES_STORAGE_KEY = 'trGeniusFiles';

// Document Management (ETP & TR)
const getSavedDocuments = (key: string): SavedDocument[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveDocuments = (key: string, docs: SavedDocument[]): void => {
  const oldDocs = getSavedDocuments(key);
  const oldDocsMap = new Map(oldDocs.map(d => [d.id, d]));

  const updatedDocs = docs.map(newDoc => {
    const oldDoc = oldDocsMap.get(newDoc.id);
    const timestamp = `[${new Date().toLocaleString('pt-BR')}]`;

    if (!oldDoc) {
      // It's a new document
      return {
        ...newDoc,
        historico: [`${timestamp} Documento criado.`]
      };
    }

    // It's an existing document, check for changes
    const changes: string[] = [];
    if (newDoc.name !== oldDoc.name) {
      changes.push(`nome alterado de "${oldDoc.name}" para "${newDoc.name}"`);
    }
    // Deep comparison is expensive, but necessary here. Stringify is a simple way.
    if (JSON.stringify(newDoc.sections) !== JSON.stringify(oldDoc.sections)) {
      changes.push('conteúdo das seções modificado');
    }
    if (JSON.stringify(newDoc.attachments || []) !== JSON.stringify(oldDoc.attachments || [])) {
      changes.push('anexos atualizados');
    }

    if (changes.length > 0) {
      const summary = `Alteração: ${changes.join(', ')}.`;
      const newHistoryEntry = `${timestamp} ${summary}`;
      const existingHistory = oldDoc.historico || [];
      return {
        ...newDoc,
        historico: [newHistoryEntry, ...existingHistory]
      };
    }

    // No changes detected, just return the doc with its old history
    return {
      ...newDoc,
      historico: oldDoc.historico || []
    };
  });


  localStorage.setItem(key, JSON.stringify(updatedDocs));
};

export const getSavedETPs = (): SavedDocument[] => getSavedDocuments(ETP_STORAGE_KEY);
export const saveETPs = (etps: SavedDocument[]): void => saveDocuments(ETP_STORAGE_KEY, etps);
export const getSavedTRs = (): SavedDocument[] => getSavedDocuments(TR_STORAGE_KEY);
export const saveTRs = (trs: SavedDocument[]): void => saveDocuments(TR_STORAGE_KEY, trs);

// Uploaded Files Management
export const getStoredFiles = (): UploadedFile[] => {
    const data = localStorage.getItem(FILES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveStoredFiles = (files: UploadedFile[]): void => {
    localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
};

// Form State Management
export const saveFormState = (key: string, state: object): void => {
    localStorage.setItem(key, JSON.stringify(state));
};

export const loadFormState = (key: string): object | null => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};