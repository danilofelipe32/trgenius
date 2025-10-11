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
  localStorage.setItem(key, JSON.stringify(docs));
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
