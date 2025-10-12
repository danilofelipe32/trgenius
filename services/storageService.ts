import { SavedDocument, UploadedFile, DocumentVersion } from '../types';

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
  const timestamp = new Date().toISOString();

  const updatedDocs = docs.map(newDoc => {
    const oldDoc = oldDocsMap.get(newDoc.id);

    if (!oldDoc) {
      // It's a brand new document
      return {
        ...newDoc,
        history: [{
          timestamp: timestamp,
          summary: 'Documento criado.',
          sections: newDoc.sections,
          attachments: newDoc.attachments
        }]
      };
    }

    // It's an existing document, check for changes
    const changes: string[] = [];
    if (newDoc.name !== oldDoc.name) {
      changes.push(`nome alterado de "${oldDoc.name}" para "${newDoc.name}"`);
    }
    if (newDoc.priority !== oldDoc.priority) {
      changes.push(`prioridade alterada de "${oldDoc.priority || 'nenhuma'}" para "${newDoc.priority}"`);
    }
    if (JSON.stringify(newDoc.sections) !== JSON.stringify(oldDoc.sections)) {
      changes.push('conteúdo das seções modificado');
    }
    if (JSON.stringify(newDoc.attachments || []) !== JSON.stringify(oldDoc.attachments || [])) {
      changes.push('anexos atualizados');
    }

    if (changes.length > 0) {
      const summary = `Alteração: ${changes.join(', ')}.`;
      
      // Create a snapshot of the *old* state before updating
      const newHistoryEntry: DocumentVersion = {
        timestamp: oldDoc.history?.[0]?.timestamp || oldDoc.createdAt, // Use timestamp of the previous version
        summary: oldDoc.history?.[0]?.summary || 'Versão inicial.',
        sections: oldDoc.sections,
        attachments: oldDoc.attachments,
      };

      const existingHistory = oldDoc.history || [];
      
      // The new history will contain the latest change summary first
      const updatedHistory = [{
          timestamp: timestamp,
          summary: summary,
          sections: newDoc.sections,
          attachments: newDoc.attachments
        }, 
        ...existingHistory
      ];
      
      return {
        ...newDoc,
        history: updatedHistory
      };
    }

    // No changes detected, just return the doc as is
    return oldDoc;
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