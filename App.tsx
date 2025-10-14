import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Section as SectionType, SavedDocument, UploadedFile, DocumentType, PreviewContext, Attachment, Priority } from './types';
import * as storage from './services/storageService';
import { callGemini } from './services/geminiService';
import { processSingleUploadedFile, processCoreFile } from './services/ragService';
import { exportDocumentToPDF } from './services/exportService';
import { Icon } from './components/Icon';
import Login from './components/Login';
import { AttachmentManager } from './components/AttachmentManager';
import InstallPWA from './components/InstallPWA';
import { HistoryViewer } from './components/HistoryViewer';
import { etpSections, trSections } from './config/sections';

declare const mammoth: any;

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
};

const base64ToUtf8 = (base64: string): string => {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    } catch(e) {
        console.error("Failed to decode base64 string:", e);
        return "Erro ao descodificar o conteúdo do ficheiro. Pode estar corrompido ou numa codificação não suportada.";
    }
};

const priorityLabels: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

// --- Helper component to render text with clickable links ---
const LinkedText: React.FC<{ text: string }> = ({ text }) => {
    const urlRegex = /(https?:\/\/\S+)/g;
    const parts = text.split(urlRegex);

    return (
        <p className="whitespace-pre-wrap text-slate-800 font-sans leading-relaxed text-base">
            {parts.map((part, index) => {
                if (urlRegex.test(part)) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                        >
                            {part}
                        </a>
                    );
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </p>
    );
};


// --- Reusable Section Component ---
interface SectionProps {
  id: string;
  title: string;
  placeholder: string;
  value: string;
  onChange: (id: string, value: string) => void;
  onGenerate: () => void;
  hasGen: boolean;
  onAnalyze?: () => void;
  hasRiskAnalysis?: boolean;
  onEdit?: () => void;
  isLoading?: boolean;
  hasError?: boolean;
  tooltip?: string;
  isOnline: boolean;
}

const Section: React.FC<SectionProps> = ({ id, title, placeholder, value, onChange, onGenerate, hasGen, onAnalyze, hasRiskAnalysis, onEdit, isLoading, hasError, tooltip, isOnline }) => {
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);
  
  const handleCopy = () => {
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-y-3">
        <div className="flex items-center gap-2">
            <label htmlFor={id} className={`block text-lg font-semibold ${hasError ? 'text-red-600' : 'text-slate-700'}`}>{title}</label>
            {tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={tooltip} />}
        </div>
        <div className="w-full sm:w-auto flex items-stretch gap-2 flex-wrap">
           {value && String(value || '').trim().length > 0 && (
             <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0 ${isCopied ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title={isCopied ? 'Copiado para a área de transferência!' : 'Copiar Conteúdo'}
            >
              <Icon name={isCopied ? 'check' : 'copy'} className="mr-2" /> 
              <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
            </button>
           )}
           {value && String(value || '').trim().length > 0 && onEdit && (
             <button
              onClick={onEdit}
              disabled={!isOnline || isLoading}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title="Editar e Refinar com IA"
            >
              <Icon name="pencil-alt" className="mr-2" />
              <span>Editar/Refinar</span>
            </button>
          )}
          {hasRiskAnalysis && onAnalyze && (
            <button
              onClick={onAnalyze}
              disabled={!isOnline || isLoading}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title={isOnline ? "Analisar Riscos com IA" : "Funcionalidade indisponível offline"}
            >
              <Icon name="shield-alt" className="mr-2" />
              <span>Análise Risco</span>
            </button>
          )}
          {hasGen && (
            <button
              onClick={onGenerate}
              disabled={!isOnline || isLoading}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title={isOnline ? "Gerar conteúdo com IA" : "Funcionalidade indisponível offline"}
            >
              <Icon name="wand-magic-sparkles" className="mr-2" />
              <span>{isLoading ? 'A gerar...' : 'Gerar com IA'}</span>
            </button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="w-full min-h-[160px] p-3 bg-slate-50 border border-slate-200 rounded-lg animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-slate-200 rounded w-full mb-3"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
        </div>
      ) : (
      <textarea
        ref={textareaRef}
        id={id}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        className={`w-full min-h-[160px] p-3 bg-slate-50 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors resize-y overflow-hidden ${hasError ? 'border-red-500 ring-red-200' : 'border-slate-200 focus:ring-blue-500'}`}
      />
      )}
    </div>
  );
};

// --- Modal Component ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-xl' }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] transition-all duration-300 transform scale-95 animate-scale-in`}
        style={{ animation: 'scale-in 0.2s ease-out forwards' }}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 -mr-2 rounded-full hover:bg-gray-100">
            <Icon name="times" className="text-xl" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-5 border-t border-gray-200 bg-slate-50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const PriorityIndicator: React.FC<{ priority?: Priority }> = ({ priority }) => {
    const priorityStyles: Record<Priority, { color: string; label: string }> = {
        low: { color: 'bg-green-500', label: 'Prioridade Baixa' },
        medium: { color: 'bg-yellow-500', label: 'Prioridade Média' },
        high: { color: 'bg-red-500', label: 'Prioridade Alta' },
    };

    if (!priority) return <div title="Prioridade não definida" className="w-3 h-3 rounded-full bg-slate-300 flex-shrink-0"></div>;

    return (
        <div
            title={priorityStyles[priority].label}
            className={`w-3 h-3 rounded-full ${priorityStyles[priority].color} flex-shrink-0`}
        ></div>
    );
};


// --- Main App Component ---
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<DocumentType | 'rag'>('etp');
  
  // State for documents
  const [savedETPs, setSavedETPs] = useState<SavedDocument[]>([]);
  const [savedTRs, setSavedTRs] = useState<SavedDocument[]>([]);
  const [etpSectionsContent, setEtpSectionsContent] = useState<Record<string, string>>({});
  const [trSectionsContent, setTrSectionsContent] = useState<Record<string, string>>({});
  const [etpAttachments, setEtpAttachments] = useState<Attachment[]>([]);
  const [trAttachments, setTrAttachments] = useState<Attachment[]>([]);
  const [loadedEtpForTr, setLoadedEtpForTr] = useState<{ id: number; name: string; content: string } | null>(null);
  const [currentDocId, setCurrentDocId] = useState<{etp: number | null, tr: number | null}>({etp: null, tr: null});


  // State for API and files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Array<{ name: string; status: 'processing' | 'success' | 'error'; message?: string }>>([]);


  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [openSidebarSections, setOpenSidebarSections] = useState({ etps: true, trs: true, rag: true });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContext, setPreviewContext] = useState<PreviewContext>({ type: null, id: null });
  const [message, setMessage] = useState<{ title: string; text: string; type?: 'success' | 'error' } | null>(null);
  const [analysisContent, setAnalysisContent] = useState<{ title: string; content: string | null }>({ title: '', content: null });
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [historyModalContent, setHistoryModalContent] = useState<SavedDocument | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null); // For PWA install prompt
  const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<{ docType: DocumentType; sectionId: string; title: string; text: string } | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Inline rename state
  const [editingDoc, setEditingDoc] = useState<{ type: DocumentType; id: number; name: string; priority?: Priority; } | null>(null);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Salvo');
  const debounceTimeoutRef = useRef<number | null>(null);
  
  // RAG file input ref
  const ragFileInputRef = useRef<HTMLInputElement>(null);

  // Filter and Sort state
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'updatedAt' | 'name'>('updatedAt');
  
  // Preview State
  const [previewContent, setPreviewContent] = useState<{ type: 'html' | 'text' | 'pdf' | 'image' ; content: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const activeDocType = activeView === 'rag' ? (currentDocId.etp ? 'etp' : 'tr') : activeView;
  const activeSections = activeDocType === 'etp' ? etpSections : trSections;
  const activeSectionsContent = activeDocType === 'etp' ? etpSectionsContent : trSectionsContent;
  const activeAttachments = activeDocType === 'etp' ? etpAttachments : trAttachments;
  
  const currentSections = useMemo(() => activeView === 'etp' ? etpSections : trSections, [activeView]);

  const getRagContext = useCallback(() => {
    if (uploadedFiles.length > 0) {
      const selectedFiles = uploadedFiles.filter(f => f.selected);
      if (selectedFiles.length > 0) {
        const context = selectedFiles
          .map(f => `Contexto do ficheiro "${f.name}":\n${f.chunks.join('\n\n')}`)
          .join('\n\n---\n\n');
        return `\n\nAdicionalmente, utilize o conteúdo dos seguintes documentos de apoio (RAG) como base de conhecimento:\n\n--- INÍCIO DOS DOCUMENTOS DE APOIO ---\n${context}\n--- FIM DOS DOCUMENTOS DE APOIO ---`;
      }
    }
    return '';
  }, [uploadedFiles]);

  const handleLogin = (success: boolean) => {
    if (success) {
        sessionStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    // Reset state
    setSavedETPs([]);
    setSavedTRs([]);
    setEtpSectionsContent({});
    setTrSectionsContent({});
    setEtpAttachments([]);
    setTrAttachments([]);
    setCurrentDocId({etp: null, tr: null});
  };
  
  const showMessage = (title: string, text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ title, text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSectionChange = useCallback((id: string, value: string) => {
    if (validationErrors.has(id)) {
        setValidationErrors(prev => {
            const newErrors = new Set(prev);
            newErrors.delete(id);
            return newErrors;
        });
    }

    setAutoSaveStatus('A escrever...');
    const updateFn = activeDocType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
    updateFn(prev => ({ ...prev, [id]: value }));
  }, [activeDocType, validationErrors]);


  const handleAttachmentsChange = useCallback((newAttachments: Attachment[]) => {
      const setFn = activeDocType === 'etp' ? setEtpAttachments : setTrAttachments;
      setFn(newAttachments);
      handleSaveDoc(true); // Auto-save on attachment change
  }, [activeDocType, etpSectionsContent, trSectionsContent, etpAttachments, trAttachments]);

  const handleGenerateSection = useCallback(async (sectionId: string) => {
    if (!isOnline) {
      showMessage('Offline', 'Não é possível usar a IA enquanto estiver offline.', 'error');
      return;
    }
    setLoadingSection(sectionId);

    const targetSection = currentSections.find(s => s.id === sectionId);
    if (!targetSection) {
      setLoadingSection(null);
      return;
    }
    
    const otherSectionsContent = Object.entries(activeSectionsContent)
        .filter(([key]) => key !== sectionId && activeSectionsContent[key])
        .map(([key, value]) => {
            const sectionTitle = currentSections.find(s => s.id === key)?.title || key;
            return `Seção "${sectionTitle}":\n${value}`;
        })
        .join('\n\n');

    const ragContext = getRagContext();
    const etpContext = loadedEtpForTr ? `Este Termo de Referência (TR) baseia-se no seguinte Estudo Técnico Preliminar (ETP):\n\n--- INÍCIO DO ETP ---\n${loadedEtpForTr.content}\n--- FIM DO ETP ---` : '';
    
    const prompt = `Você é um especialista em licitações e contratos públicos no Brasil, atuando estritamente sob a Lei 14.133/21.
Sua tarefa é gerar o conteúdo para a seção "${targetSection.title}" de um ${activeDocType === 'etp' ? 'Estudo Técnico Preliminar (ETP)' : 'Termo de Referência (TR)'}.
O placeholder para esta seção é: "${targetSection.placeholder}".
${otherSectionsContent ? `Para contexto, aqui está o conteúdo de outras seções já preenchidas:\n${otherSectionsContent}` : ''}
${etpContext}
${ragContext}
Gere um texto técnico, formal e completo para a seção "${targetSection.title}", seguindo as diretrizes do placeholder e da Lei 14.133/21. Seja claro, objetivo e atenda a todos os pontos essenciais. Evite redundâncias. Não inclua o título da seção na sua resposta, apenas o conteúdo.`;

    const result = await callGemini(prompt);
    
    if (result.startsWith("Erro:")) {
        showMessage('Erro de IA', result, 'error');
    } else {
        const updateFn = activeDocType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
        updateFn(prev => ({ ...prev, [sectionId]: result }));
        showMessage('Sucesso', `Conteúdo para "${targetSection.title}" gerado com sucesso.`);
    }

    setLoadingSection(null);
  }, [isOnline, activeDocType, activeSectionsContent, currentSections, getRagContext, loadedEtpForTr]);
  
  const handleFileUpload = async (files: FileList) => {
    if (!isOnline) {
      showMessage('Offline', 'Não é possível fazer upload de ficheiros enquanto estiver offline.', 'error');
      return;
    }
    const fileList = Array.from(files);
    const newProcessingStatus = fileList.map(f => ({ name: f.name, status: 'processing' as const }));
    setProcessingFiles(prev => [...prev, ...newProcessingStatus]);

    const existingNames = uploadedFiles.map(f => f.name);
    
    let allFiles = [...uploadedFiles];
    for (const file of fileList) {
        try {
            const processedFile = await processSingleUploadedFile(file, existingNames);
            allFiles.push(processedFile);
            setProcessingFiles(prev => prev.map(p => p.name === file.name ? { ...p, status: 'success' } : p));
        } catch (error: any) {
            setProcessingFiles(prev => prev.map(p => p.name === file.name ? { ...p, status: 'error', message: error.message } : p));
        }
    }
    setUploadedFiles(allFiles);
    storage.saveStoredFiles(allFiles);
    
    setTimeout(() => setProcessingFiles([]), 5000); // Clear status after 5 seconds
  };
  
  const handleToggleFileSelection = (indexToToggle: number) => {
    const newFiles = uploadedFiles.map((file, index) => 
        index === indexToToggle ? { ...file, selected: !file.selected } : file
    );
    setUploadedFiles(newFiles);
    storage.saveStoredFiles(newFiles);
  };
  
  const handleDeleteFile = (indexToDelete: number) => {
    if (window.confirm("Tem a certeza de que pretende eliminar este ficheiro de apoio?")) {
        const newFiles = uploadedFiles.filter((_, index) => index !== indexToDelete);
        setUploadedFiles(newFiles);
        storage.saveStoredFiles(newFiles);
    }
  };

  const handleSaveDoc = (isAutoSave = false) => {
    const docType = activeDocType;
    const content = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    const attachments = docType === 'etp' ? etpAttachments : trAttachments;
    const savedDocs = docType === 'etp' ? savedETPs : savedTRs;
    const setSavedDocs = docType === 'etp' ? setSavedETPs : setSavedTRs;
    const saveFn = docType === 'etp' ? storage.saveETPs : storage.saveTRs;
    const docId = docType === 'etp' ? currentDocId.etp : currentDocId.tr;

    if (!docId) {
        if (!isAutoSave) showMessage('Erro', 'Nenhum documento carregado para salvar.', 'error');
        return;
    }
    
    const docIndex = savedDocs.findIndex(d => d.id === docId);
    if (docIndex === -1) {
        if (!isAutoSave) showMessage('Erro', `Documento com ID ${docId} não encontrado.`, 'error');
        return;
    }

    const updatedDoc: SavedDocument = {
        ...savedDocs[docIndex],
        sections: content,
        attachments: attachments,
        updatedAt: new Date().toISOString()
    };
    
    const newSavedDocs = [...savedDocs];
    newSavedDocs[docIndex] = updatedDoc;

    setSavedDocs(newSavedDocs);
    saveFn(newSavedDocs);
    if (!isAutoSave) {
        showMessage('Sucesso', 'Documento salvo com sucesso!');
    } else {
        setAutoSaveStatus('Salvo ✓');
    }
  };
  
  const handleLoadDoc = (docType: DocumentType, id: number) => {
    const docs = docType === 'etp' ? savedETPs : savedTRs;
    const doc = docs.find(d => d.id === id);
    if (doc) {
        if (docType === 'etp') {
            setEtpSectionsContent(doc.sections);
            setEtpAttachments(doc.attachments || []);
            setCurrentDocId(prev => ({...prev, etp: id}));
            setActiveView('etp');
        } else {
            setTrSectionsContent(doc.sections);
            setTrAttachments(doc.attachments || []);
            setCurrentDocId(prev => ({...prev, tr: id}));
            setActiveView('tr');
        }
        showMessage('Sucesso', `Documento "${doc.name}" carregado.`);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } else {
        showMessage('Erro', 'Documento não encontrado.', 'error');
    }
  };

  const handleNewDoc = (type: DocumentType, name: string, priority: Priority) => {
    const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections: {},
        attachments: [],
        history: [],
    };

    if (type === 'etp') {
        const updatedETPs = [...savedETPs, newDoc];
        setSavedETPs(updatedETPs);
        storage.saveETPs(updatedETPs);
        handleLoadDoc('etp', newDoc.id);
    } else {
        const updatedTRs = [...savedTRs, newDoc];
        setSavedTRs(updatedTRs);
        storage.saveTRs(updatedTRs);
        handleLoadDoc('tr', newDoc.id);
    }
    setIsNewDocModalOpen(false);
  };
  
  const handleDeleteDoc = (docType: DocumentType, id: number) => {
    if (!window.confirm("Tem a certeza de que pretende eliminar este documento? Esta ação não pode ser revertida.")) return;

    if (docType === 'etp') {
        const newETPs = savedETPs.filter(d => d.id !== id);
        setSavedETPs(newETPs);
        storage.saveETPs(newETPs);
        if (currentDocId.etp === id) {
            setEtpSectionsContent({});
            setEtpAttachments([]);
            setCurrentDocId(prev => ({...prev, etp: null}));
        }
    } else {
        const newTRs = savedTRs.filter(d => d.id !== id);
        setSavedTRs(newTRs);
        storage.saveTRs(newTRs);
        if (currentDocId.tr === id) {
            setTrSectionsContent({});
            setTrAttachments([]);
            setCurrentDocId(prev => ({...prev, tr: null}));
        }
    }
    showMessage('Sucesso', 'Documento eliminado com sucesso.');
  };
  
  const handleSaveEditedDoc = () => {
    if (!editingDoc) return;
    const { type, id, name, priority } = editingDoc;

    if (type === 'etp') {
        const updatedETPs = savedETPs.map(d => d.id === id ? { ...d, name, priority, updatedAt: new Date().toISOString() } : d);
        setSavedETPs(updatedETPs);
        storage.saveETPs(updatedETPs);
    } else {
        const updatedTRs = savedTRs.map(d => d.id === id ? { ...d, name, priority, updatedAt: new Date().toISOString() } : d);
        setSavedTRs(updatedTRs);
        storage.saveTRs(updatedTRs);
    }
    setEditingDoc(null);
  };

  // --- Effects ---
  useEffect(() => {
    const loggedIn = sessionStorage.getItem('isAuthenticated') === 'true';
    if (loggedIn) setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadInitialData = async () => {
        setSavedETPs(storage.getSavedETPs());
        setSavedTRs(storage.getSavedTRs());
        setEtpSectionsContent(storage.loadFormState('etpFormState') as Record<string, string> || {});
        setTrSectionsContent(storage.loadFormState('trFormState') as Record<string, string> || {});
        
        // Load core RAG file
        try {
            const response = await fetch('./lei14133.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const lei14133Data = await response.json();
            const coreFile = await processCoreFile(lei14133Data, 'Lei 14.133/21 (Referência)');
            
            const storedFiles = storage.getStoredFiles();
            // Ensure core file is always present and not duplicated
            const otherFiles = storedFiles.filter(f => !f.isCore);
            const allFiles = [coreFile, ...otherFiles];
            setUploadedFiles(allFiles);
            storage.saveStoredFiles(allFiles);
        } catch (error) {
            console.error("Failed to load core RAG file:", error);
            showMessage("Erro Crítico", "Não foi possível carregar o ficheiro da lei. A funcionalidade de IA pode ser afetada.", 'error');
            setUploadedFiles(storage.getStoredFiles());
        }
    };

    loadInitialData();

    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);
  
  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
        if (!sessionStorage.getItem('pwaInstallDismissed')) {
            setIsInstallBannerVisible(true);
        }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Online status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}, []);

  // Auto-save Effect
  useEffect(() => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if ((currentDocId.etp || currentDocId.tr) && (Object.keys(etpSectionsContent).length > 0 || Object.keys(trSectionsContent).length > 0)) {
        debounceTimeoutRef.current = window.setTimeout(() => {
            setAutoSaveStatus('A salvar...');
            storage.saveFormState('etpFormState', etpSectionsContent);
            storage.saveFormState('trFormState', trSectionsContent);
            handleSaveDoc(true);
        }, 2000);
      }
      return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [etpSectionsContent, trSectionsContent, currentDocId.etp, currentDocId.tr]);
  
  // Attachment Preview Generator
  useEffect(() => {
    if (!viewingAttachment) {
        setPreviewContent(null);
        return;
    }

    const { type, content, name } = viewingAttachment;
    setIsLoadingPreview(true);
    setPreviewContent(null);

    (async () => {
        try {
            if (type.startsWith('image/')) {
                setPreviewContent({ type: 'image', content: `data:${type};base64,${content}` });
            } else if (type === 'application/pdf') {
                setPreviewContent({ type: 'pdf', content: `data:application/pdf;base64,${content}` });
            } else if (type === 'text/plain' || name.toLowerCase().endsWith('.txt')) {
                setPreviewContent({ type: 'text', content: base64ToUtf8(content) });
            } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.toLowerCase().endsWith('.docx')) {
                const arrayBuffer = base64ToArrayBuffer(content);
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setPreviewContent({ type: 'html', content: result.value });
            } else {
                setPreviewContent(null); 
            }
        } catch (err) {
            console.error("Error generating preview for", name, err);
            setPreviewContent({ type: 'html', content: `<p class="text-red-500 font-semibold p-4">Erro ao pré-visualizar o ficheiro ${name}.</p>` });
        } finally {
            setIsLoadingPreview(false);
        }
    })();
  }, [viewingAttachment]);

  const handleOpenEditModal = (sectionId: string) => {
    const section = currentSections.find(s => s.id === sectionId);
    if (section) {
        setEditingContent({
            docType: activeDocType,
            sectionId,
            title: section.title,
            text: activeSectionsContent[sectionId] || ''
        });
        setIsEditModalOpen(true);
    }
  };

  const handleRefineContent = async () => {
    if (!editingContent || !refinePrompt) return;
    setIsRefining(true);

    const prompt = `Você é um especialista em licitações e contratos públicos no Brasil, atuando sob a Lei 14.133/21.
Sua tarefa é refinar o seguinte texto da seção "${editingContent.title}" de um documento:

--- TEXTO ORIGINAL ---
${editingContent.text}
--- FIM DO TEXTO ORIGINAL ---

A instrução para refinar o texto é: "${refinePrompt}".

${getRagContext()}

Aplique a instrução e retorne APENAS o texto refinado, mantendo o tom técnico e formal.`;

    const result = await callGemini(prompt);
    if (result.startsWith("Erro:")) {
        showMessage('Erro de IA', result, 'error');
    } else {
        setEditingContent(prev => prev ? { ...prev, text: result } : null);
        setRefinePrompt('');
    }
    setIsRefining(false);
  };
  
  const handleAcceptRefinement = () => {
    if (editingContent) {
        handleSectionChange(editingContent.sectionId, editingContent.text);
        setIsEditModalOpen(false);
        setEditingContent(null);
    }
  };

  const filteredDocs = useCallback((docs: SavedDocument[]) => {
    return docs
      .filter(doc => priorityFilter === 'all' || doc.priority === priorityFilter)
      .filter(doc => doc.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === 'name') {
          return a.name.localeCompare(b.name);
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); // default 'updatedAt'
      });
  }, [priorityFilter, searchTerm, sortOrder]);

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;
  
  const currentDocName = useMemo(() => {
    const docId = activeView === 'etp' ? currentDocId.etp : currentDocId.tr;
    if (!docId) return "Nenhum documento aberto";
    const docs = activeView === 'etp' ? savedETPs : savedTRs;
    return docs.find(d => d.id === docId)?.name || "Documento não encontrado";
  }, [activeView, currentDocId, savedETPs, savedTRs]);

  // --- Reusable Sidebar Section ---
  const SidebarSection: React.FC<{title: string; type: 'etps' | 'trs' | 'rag'; children: React.ReactNode; count: number;}> = ({title, type, children, count}) => (
    <div>
      <button onClick={() => setOpenSidebarSections(s => ({...s, [type]: !s[type]}))} className="w-full flex justify-between items-center text-left text-sm font-bold text-slate-500 hover:text-slate-800 p-2 rounded-md hover:bg-slate-100">
        <span>{title} ({count})</span>
        <Icon name={openSidebarSections[type] ? 'chevron-down' : 'chevron-right'} />
      </button>
      {openSidebarSections[type] && <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200">{children}</div>}
    </div>
  );

  // --- RAG file manager ---
  const RagManager = () => (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Gerir Ficheiros de Apoio (RAG)</h2>
        <p className="text-slate-600 mb-6 text-sm">Selecione os ficheiros que devem ser utilizados como contexto para a IA. O ficheiro da Lei 14.133/21 é essencial e está sempre selecionado.</p>
        
        <div className="mb-6">
            <div
                onClick={() => ragFileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 border-slate-300 hover:border-blue-400 hover:bg-slate-50"
            >
                <Icon name="cloud-upload-alt" className="text-4xl text-slate-400 mb-3" />
                <p className="text-slate-600 text-center"><span className="font-semibold text-blue-600">Clique para carregar</span> ou arraste e solte</p>
                <input ref={ragFileInputRef} type="file" multiple onChange={(e) => e.target.files && handleFileUpload(e.target.files)} className="hidden" />
            </div>
        </div>
        
        <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
                <div key={file.name} className={`flex items-center p-3 rounded-lg border transition-colors ${file.selected ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                    <Icon name="file-alt" className="text-slate-500 mr-4 flex-shrink-0" />
                    <div className="flex-grow truncate mr-4">
                        <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600" title={file.isCore ? "Este ficheiro é essencial e não pode ser desmarcado" : "Usar este ficheiro como contexto para a IA"}>
                            <input type="checkbox" checked={file.selected} disabled={file.isCore} onChange={() => handleToggleFileSelection(index)} className="form-checkbox h-5 w-5 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                            <span className='hidden sm:inline'>Usar na IA</span>
                        </label>
                        {!file.isCore && (
                            <button onClick={() => handleDeleteFile(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100" title="Remover ficheiro">
                                <Icon name="trash" />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  // Main Render
  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800 flex">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 w-80 min-h-screen flex-col flex-shrink-0 p-4 fixed lg:relative lg:translate-x-0 h-full z-40 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-blue-600">TR Genius</h1>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-slate-100" title="Sair">
                <Icon name="sign-out-alt" />
            </button>
        </div>
        
        {/* Document list, filters, etc */}
        <div className="flex-grow overflow-y-auto pr-2 -mr-2">
            <div className='space-y-4'>
                <button onClick={() => setIsNewDocModalOpen(true)} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Icon name="plus-circle" /> Novo Documento
                </button>
                {/* Filters */}
                <div className="space-y-3 p-3 bg-slate-100 rounded-lg">
                    <div className="relative">
                        <input type="text" placeholder="Procurar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    </div>
                    <div className="flex gap-2">
                        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} className="w-full text-sm bg-white border border-slate-300 rounded-md px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">Todas as Prioridades</option>
                            <option value="high">Alta</option>
                            <option value="medium">Média</option>
                            <option value="low">Baixa</option>
                        </select>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="w-full text-sm bg-white border border-slate-300 rounded-md px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500">
                            <option value="updatedAt">Ordenar por Data</option>
                            <option value="name">Ordenar por Nome</option>
                        </select>
                    </div>
                </div>
                {/* ETPs */}
                <SidebarSection title="Estudos Técnicos (ETP)" type="etps" count={filteredDocs(savedETPs).length}>
                    {filteredDocs(savedETPs).map(doc => (
                        <div key={doc.id} className={`group p-2 rounded-md transition-colors ${currentDocId.etp === doc.id ? 'bg-blue-100' : 'hover:bg-slate-100'}`}>
                            {editingDoc?.id === doc.id && editingDoc.type === 'etp' ? (
                                <div className="space-y-2">
                                    <input type="text" value={editingDoc.name} onChange={e => setEditingDoc({...editingDoc, name: e.target.value})} className="w-full text-sm font-semibold p-1 border rounded" />
                                    <select value={editingDoc.priority} onChange={e => setEditingDoc({...editingDoc, priority: e.target.value as Priority})} className="w-full text-xs p-1 border rounded bg-white">
                                        {Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveEditedDoc} className="flex-1 text-xs bg-green-500 text-white rounded px-2 py-1">Guardar</button>
                                        <button onClick={() => setEditingDoc(null)} className="flex-1 text-xs bg-slate-200 rounded px-2 py-1">Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div onClick={() => handleLoadDoc('etp', doc.id)} className="flex items-center gap-2 cursor-pointer">
                                        <PriorityIndicator priority={doc.priority} />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{doc.name}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingDoc({type: 'etp', id: doc.id, name: doc.name, priority: doc.priority})} title="Editar Nome/Prioridade" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="edit" className="text-xs" /></button>
                                        <button onClick={() => setHistoryModalContent(doc)} title="Ver Histórico" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="history" className="text-xs" /></button>
                                        <button onClick={() => exportDocumentToPDF(doc, etpSections)} title="Exportar para PDF" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="file-pdf" className="text-xs" /></button>
                                        <button onClick={() => handleDeleteDoc('etp', doc.id)} title="Eliminar" className="p-1.5 rounded hover:bg-red-100 text-slate-500 hover:text-red-600"><Icon name="trash" className="text-xs" /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </SidebarSection>
                {/* TRs */}
                 <SidebarSection title="Termos de Referência (TR)" type="trs" count={filteredDocs(savedTRs).length}>
                    {filteredDocs(savedTRs).map(doc => (
                         <div key={doc.id} className={`group p-2 rounded-md transition-colors ${currentDocId.tr === doc.id ? 'bg-blue-100' : 'hover:bg-slate-100'}`}>
                            {editingDoc?.id === doc.id && editingDoc.type === 'tr' ? (
                                <div className="space-y-2">
                                    <input type="text" value={editingDoc.name} onChange={e => setEditingDoc({...editingDoc, name: e.target.value})} className="w-full text-sm font-semibold p-1 border rounded" />
                                    <select value={editingDoc.priority} onChange={e => setEditingDoc({...editingDoc, priority: e.target.value as Priority})} className="w-full text-xs p-1 border rounded bg-white">
                                        {Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveEditedDoc} className="flex-1 text-xs bg-green-500 text-white rounded px-2 py-1">Guardar</button>
                                        <button onClick={() => setEditingDoc(null)} className="flex-1 text-xs bg-slate-200 rounded px-2 py-1">Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div onClick={() => handleLoadDoc('tr', doc.id)} className="flex items-center gap-2 cursor-pointer">
                                        <PriorityIndicator priority={doc.priority} />
                                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{doc.name}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingDoc({type: 'tr', id: doc.id, name: doc.name, priority: doc.priority})} title="Editar Nome/Prioridade" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="edit" className="text-xs" /></button>
                                        <button onClick={() => setHistoryModalContent(doc)} title="Ver Histórico" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="history" className="text-xs" /></button>
                                        <button onClick={() => exportDocumentToPDF(doc, trSections)} title="Exportar para PDF" className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"><Icon name="file-pdf" className="text-xs" /></button>
                                        <button onClick={() => handleDeleteDoc('tr', doc.id)} title="Eliminar" className="p-1.5 rounded hover:bg-red-100 text-slate-500 hover:text-red-600"><Icon name="trash" className="text-xs" /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </SidebarSection>
                {/* RAG files */}
                <SidebarSection title="Ficheiros de Apoio (RAG)" type="rag" count={uploadedFiles.length}>
                    {uploadedFiles.map((file, index) => (
                        <div key={file.name} className={`flex items-center gap-2 p-2 rounded-md ${activeView === 'rag' ? 'bg-blue-100' : ''}`} onClick={() => setActiveView('rag')}>
                            <Icon name={file.isCore ? "bookmark" : "file-alt"} className="text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 flex-1 truncate">{file.name}</span>
                        </div>
                    ))}
                </SidebarSection>
            </div>
        </div>
        <div className="text-center text-xs text-slate-400 pt-2 border-t">
            Versão 1.0.1
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col transition-all duration-300">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 text-slate-600">
                    <Icon name={isSidebarOpen ? "times" : "bars"} />
                </button>
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-slate-800">{currentDocName}</h2>
                    <span className="text-xs text-slate-500">{autoSaveStatus}</span>
                </div>
            </div>
            <div className="flex items-center gap-4">
              {!isOnline && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full" title="Você está offline. Algumas funcionalidades estão desativadas.">
                      <Icon name="wifi-slash" />
                      <span>Offline</span>
                  </div>
              )}
              <button onClick={() => handleSaveDoc()} disabled={autoSaveStatus === 'Salvo ✓'} className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  <Icon name="save" /> Salvar
              </button>
            </div>
        </header>
        
        {/* Document Sections */}
        <div className="flex-grow p-4 md:p-6 overflow-y-auto" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          {activeView !== 'rag' ? (
            <div>
              {(activeView === 'etp' && !currentDocId.etp) || (activeView === 'tr' && !currentDocId.tr) ? (
                <div className="text-center text-slate-500 mt-16 flex flex-col items-center">
                  <Icon name="file-alt" className="text-6xl mb-4 text-slate-300" />
                  <h3 className="text-xl font-bold">Nenhum documento aberto</h3>
                  <p>Crie um novo documento ou carregue um existente na barra lateral.</p>
                </div>
              ) : (
                currentSections.map(section => (
                  section.isAttachmentSection ? (
                      <div key={section.id} className="bg-white p-4 md:p-6 rounded-xl shadow-sm mb-6">
                          <h3 className="text-lg font-semibold text-slate-700 mb-4">{section.title}</h3>
                          <AttachmentManager
                              attachments={activeAttachments}
                              onAttachmentsChange={handleAttachmentsChange}
                              onPreview={setViewingAttachment}
                              setMessage={setMessage}
                          />
                      </div>
                  ) : (
                      <Section
                          key={section.id}
                          id={section.id}
                          title={section.title}
                          placeholder={section.placeholder}
                          value={activeSectionsContent[section.id] || ''}
                          onChange={(id, value) => handleSectionChange(id, value)}
                          onGenerate={() => handleGenerateSection(section.id)}
                          onEdit={() => handleOpenEditModal(section.id)}
                          hasGen={section.hasGen}
                          isLoading={loadingSection === section.id}
                          hasError={validationErrors.has(section.id)}
                          tooltip={section.tooltip}
                          isOnline={isOnline}
                      />
                  )
                ))
              )}
            </div>
          ) : (
            <RagManager />
          )}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[{view: 'etp', icon: 'file-alt', label: 'ETP'}, {view: 'tr', icon: 'file-signature', label: 'TR'}, {view: 'rag', icon: 'book', label: 'Arquivos'}].map(item => (
              <button 
                  key={item.view}
                  onClick={() => setActiveView(item.view as any)}
                  className={`flex flex-col items-center justify-center p-2 w-full text-sm transition-colors ${activeView === item.view ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}
              >
                  <Icon name={item.icon} className="text-xl mb-1" />
                  <span>{item.label}</span>
              </button>
          ))}
      </nav>

      {/* Modals */}
      <Modal isOpen={isNewDocModalOpen} onClose={() => setIsNewDocModalOpen(false)} title="Criar Novo Documento">
          <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const type = formData.get('type') as DocumentType;
              const name = formData.get('name') as string;
              const priority = formData.get('priority') as Priority;
              if (type && name && priority) {
                  handleNewDoc(type, name, priority);
              }
          }}>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Documento</label>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                              <input type="radio" name="type" value="etp" required defaultChecked className="form-radio text-blue-600 focus:ring-blue-500" />
                              <span><Icon name="file-alt" className="mr-2" />Estudo Técnico (ETP)</span>
                          </label>
                          <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                              <input type="radio" name="type" value="tr" required className="form-radio text-blue-600 focus:ring-blue-500" />
                              <span><Icon name="file-signature" className="mr-2" />Termo de Referência (TR)</span>
                          </label>
                      </div>
                  </div>
                  <div>
                      <label htmlFor="docName" className="block text-sm font-medium text-slate-700">Nome do Documento</label>
                      <input type="text" id="docName" name="name" required placeholder="Ex: Contratação de serviço de limpeza" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                      <label htmlFor="docPriority" className="block text-sm font-medium text-slate-700">Prioridade</label>
                      <select id="docPriority" name="priority" defaultValue="medium" required className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                          <option value="high">Alta</option>
                          <option value="medium">Média</option>
                          <option value="low">Baixa</option>
                      </select>
                  </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsNewDocModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Criar</button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Editar/Refinar: ${editingContent?.title}`} maxWidth="max-w-3xl">
          <div className="space-y-4">
              <textarea value={editingContent?.text} onChange={e => setEditingContent(prev => prev ? {...prev, text: e.target.value} : null)} rows={10} className="w-full p-2 border rounded-md bg-slate-50"/>
              <div className="flex gap-2 items-center">
                  <input type="text" value={refinePrompt} onChange={e => setRefinePrompt(e.target.value)} placeholder="Instrução para refinar (ex: 'tornar mais conciso', 'adicionar detalhes sobre...', 'mudar para um tom mais formal')" className="flex-1 p-2 border rounded-md" />
                  <button onClick={handleRefineContent} disabled={isRefining || !isOnline} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {isRefining ? <Icon name="spinner" className="fa-spin" /> : <Icon name="wand-magic-sparkles" />}
                  </button>
              </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancelar</button>
              <button type="button" onClick={handleAcceptRefinement} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700">Aceitar e Guardar</button>
          </div>
      </Modal>
      
      <Modal isOpen={!!historyModalContent} onClose={() => setHistoryModalContent(null)} title={`Histórico de: ${historyModalContent?.name}`} maxWidth="max-w-6xl">
        {historyModalContent && <HistoryViewer document={historyModalContent} allSections={historyModalContent && savedETPs.some(d => d.id === historyModalContent.id) ? etpSections : trSections} />}
      </Modal>
      
       <Modal isOpen={!!viewingAttachment} onClose={() => setViewingAttachment(null)} title={viewingAttachment?.name || 'Visualizador'} maxWidth="max-w-4xl">
        {isLoadingPreview ? (
            <div className="text-center p-8"><Icon name="spinner" className="fa-spin text-3xl text-slate-500" /></div>
        ) : previewContent ? (
            previewContent.type === 'html' ? <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewContent.content }} /> :
            previewContent.type === 'text' ? <pre className="whitespace-pre-wrap text-sm">{previewContent.content}</pre> :
            previewContent.type === 'image' ? <img src={previewContent.content} alt="preview" className="max-w-full h-auto rounded-lg" /> :
            previewContent.type === 'pdf' ? <iframe src={previewContent.content} className="w-full h-[70vh]" title="preview" /> :
            <p className="text-center p-4">Pré-visualização não suportada para este tipo de ficheiro.</p>
        ) : (
            <p className="text-center p-4">Não foi possível gerar a pré-visualização.</p>
        )}
      </Modal>

      <Modal isOpen={!!analysisContent.content} onClose={() => setAnalysisContent({ title: '', content: null })} title={analysisContent.title}>
          {analysisContent.content && <LinkedText text={analysisContent.content} />}
      </Modal>

      {message && (
          <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg animate-fade-in-out ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              <h4 className="font-bold">{message.title}</h4>
              <p className="text-sm">{message.text}</p>
          </div>
      )}
      <style>{`
        @keyframes fade-in-out {
          0% { opacity: 0; transform: translateY(-20px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 5s ease-in-out forwards;
        }
      `}</style>


      {isInstallBannerVisible && installPrompt && <InstallPWA onInstall={() => installPrompt?.prompt()} onDismiss={() => { setIsInstallBannerVisible(false); sessionStorage.setItem('pwaInstallDismissed', 'true'); }} />}
    </div>
  );
};

export default App;