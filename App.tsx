import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Section as SectionType, SavedDocument, UploadedFile, DocumentType, PreviewContext, Attachment, DocumentVersion, Priority } from './types';
import * as storage from './services/storageService';
import { callGemini } from './services/geminiService';
import { processSingleUploadedFile, chunkText } from './services/ragService';
import { exportDocumentToPDF } from './services/exportService';
import { Icon } from './components/Icon';
import Login from './components/Login';
import { AttachmentManager } from './components/AttachmentManager';
import InstallPWA from './components/InstallPWA';
import { HistoryViewer } from './components/HistoryViewer';
import { etpSections, trSections } from './config/sections';
import lawData from './lei14133.json';

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
}

const Section: React.FC<SectionProps> = ({ id, title, placeholder, value, onChange, onGenerate, hasGen, onAnalyze, hasRiskAnalysis, onEdit, isLoading, hasError, tooltip }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (!value || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
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
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title="Editar e Refinar"
            >
              <Icon name="pencil-alt" className="mr-2" />
              <span>Editar/Refinar</span>
            </button>
          )}
          {hasRiskAnalysis && onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors min-w-[calc(50%-0.25rem)] sm:min-w-0"
              title="Análise de Riscos"
            >
              <Icon name="shield-alt" className="mr-2" />
              <span>Análise Risco</span>
            </button>
          )}
          {hasGen && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center text-center px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[calc(50%-0.25rem)] sm:min-w-0"
            >
              <Icon name={isLoading ? 'spinner' : 'wand-magic-sparkles'} className={`mr-2 ${isLoading ? 'fa-spin' : ''}`} />
              <span>{isLoading ? 'A gerar...' : 'Gerar com IA'}</span>
            </button>
          )}
        </div>
      </div>
      <textarea
        id={id}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={isLoading ? 'A IA está a gerar o conteúdo...' : placeholder}
        className={`w-full h-40 p-3 bg-slate-50 border rounded-lg focus:ring-2 transition-colors ${hasError ? 'border-red-500 ring-red-200' : 'border-slate-200 focus:ring-blue-500'} ${isLoading ? 'animate-pulse-bg' : ''}`}
        disabled={isLoading}
      />
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
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh] transition-all duration-300 transform scale-95 animate-scale-in`} style={{ animation: 'scale-in 0.2s ease-out forwards' }}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Icon name="times" className="text-2xl" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-5 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
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
  const [activeView, setActiveView] = useState<DocumentType>('etp');
  
  // State for documents
  const [savedETPs, setSavedETPs] = useState<SavedDocument[]>([]);
  const [savedTRs, setSavedTRs] = useState<SavedDocument[]>([]);
  const [etpSectionsContent, setEtpSectionsContent] = useState<Record<string, string>>({});
  const [trSectionsContent, setTrSectionsContent] = useState<Record<string, string>>({});
  const [etpAttachments, setEtpAttachments] = useState<Attachment[]>([]);
  const [trAttachments, setTrAttachments] = useState<Attachment[]>([]);
  const [loadedEtpForTr, setLoadedEtpForTr] = useState<{ id: number; name: string; content: string } | null>(null);

  // State for API and files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Array<{ name: string; status: 'processing' | 'success' | 'error'; message?: string }>>([]);


  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [openSidebarSections, setOpenSidebarSections] = useState({ etps: true, trs: true, rag: true });
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContext, setPreviewContext] = useState<PreviewContext>({ type: null, id: null });
  const [message, setMessage] = useState<{ title: string; text: string } | null>(null);
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
  const [editingDoc, setEditingDoc] = useState<{ type: DocumentType; id: number; name: string; priority: Priority; } | null>(null);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Salvo');
  const debounceTimeoutRef = useRef<number | null>(null);
  const etpContentRef = useRef(etpSectionsContent);
  const trContentRef = useRef(trSectionsContent);

  // Filter and Sort state
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'updatedAt' | 'name'>('updatedAt');
  
  // Summary state
  const [summaryState, setSummaryState] = useState<{ loading: boolean; content: string | null }>({ loading: false, content: null });
  
  // Preview State
  const [previewContent, setPreviewContent] = useState<{ type: 'html' | 'text'; content: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);


  const priorityFilters: {
    key: 'all' | Priority;
    label: string;
    activeClasses: string;
    inactiveClasses: string;
  }[] = [
    { key: 'all', label: 'Todos', activeClasses: 'bg-white shadow-sm text-slate-800', inactiveClasses: 'text-slate-500 hover:bg-slate-200' },
    { key: 'high', label: 'Alta', activeClasses: 'bg-red-500 text-white shadow-sm', inactiveClasses: 'text-red-700 hover:bg-red-100' },
    { key: 'medium', label: 'Média', activeClasses: 'bg-yellow-500 text-white shadow-sm', inactiveClasses: 'text-yellow-700 hover:bg-yellow-100' },
    { key: 'low', label: 'Baixa', activeClasses: 'bg-green-500 text-white shadow-sm', inactiveClasses: 'text-green-700 hover:bg-green-100' },
  ];


  // --- Effects ---
  useEffect(() => {
    const loggedIn = sessionStorage.getItem('isAuthenticated') === 'true';
    if (loggedIn) {
        setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadInitialData = async () => {
        const etps = storage.getSavedETPs();
        setSavedETPs(etps);
        setSavedTRs(storage.getSavedTRs());

        const etpFormState = storage.loadFormState('etpFormState') as Record<string, string> || {};
        setEtpSectionsContent(etpFormState);

        // Find the last active ETP to load its attachments
        const lastActiveEtp = etps.find(etp => JSON.stringify(etp.sections) === JSON.stringify(etpFormState));
        if (lastActiveEtp) {
            setEtpAttachments(lastActiveEtp.attachments || []);
        }

        setTrSectionsContent(storage.loadFormState('trFormState') as Record<string, string> || {});
        
        const userFiles = storage.getStoredFiles();

        try {
            const lawContent = lawData as { page: number; content: string }[];
            const fullText = lawContent.map(item => item.content).join('\n\n');
            const chunks = chunkText(fullText);

            const lawFile: UploadedFile = {
                name: 'lei14133.json',
                chunks,
                selected: true,
                isCore: true
            };
            
            const existingUserFiles = userFiles.filter(f => !f.isCore);
            setUploadedFiles([lawFile, ...existingUserFiles]);

        } catch (error) {
            console.error("Erro ao carregar a base de conhecimento:", error);
            setMessage({ title: 'Erro de Carregamento', text: `Não foi possível carregar a base de conhecimento principal (lei14133.json). Algumas funcionalidades podem ser afetadas. Detalhes: Error: Falha ao carregar a base de conhecimento.` });
            setUploadedFiles(userFiles);
        }
    };

    loadInitialData();

    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpen(true);
        } else {
            setIsSidebarOpen(false);
        }
    };
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

    return () => {
        window.removeEventListener('beforeinstallprompt', handler);
    };
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

  // --- Auto-save Effects ---
  useEffect(() => {
      etpContentRef.current = etpSectionsContent;
  }, [etpSectionsContent]);

  useEffect(() => {
      trContentRef.current = trSectionsContent;
  }, [trSectionsContent]);
  
  // Debounced save on change
  useEffect(() => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

      debounceTimeoutRef.current = window.setTimeout(() => {
          setAutoSaveStatus('Salvando...');
          storage.saveFormState('etpFormState', etpSectionsContent);
          storage.saveFormState('trFormState', trSectionsContent);
          setTimeout(() => setAutoSaveStatus('Salvo ✓'), 500);
      }, 2000); // 2 seconds after user stops typing

      return () => {
          if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      };
  }, [etpSectionsContent, trSectionsContent]);

  // Periodic save every 30 seconds
  useEffect(() => {
      const interval = setInterval(() => {
          setAutoSaveStatus('Salvando...');
          // Use refs to get the latest state, avoiding stale closures
          storage.saveFormState('etpFormState', etpContentRef.current);
          storage.saveFormState('trFormState', trContentRef.current);
          setTimeout(() => setAutoSaveStatus('Salvo ✓'), 500);
      }, 30000);

      return () => clearInterval(interval);
  }, []); // Run only once
  
  // Attachment Preview Generator
  useEffect(() => {
    if (!viewingAttachment) {
        setPreviewContent(null);
        return;
    }

    const { type, content, name } = viewingAttachment;
    const lowerCaseName = name.toLowerCase();

    if (type === 'text/plain' || lowerCaseName.endsWith('.txt')) {
        setPreviewContent({ type: 'text', content: base64ToUtf8(content) });
    } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerCaseName.endsWith('.docx')) {
        setIsLoadingPreview(true);
        setPreviewContent(null);
        try {
            const arrayBuffer = base64ToArrayBuffer(content);
            mammoth.convertToHtml({ arrayBuffer })
                .then((result: { value: string }) => {
                    setPreviewContent({ type: 'html', content: result.value });
                })
                .catch((err: any) => {
                    console.error("Error converting docx to html", err);
                    setPreviewContent({ type: 'html', content: '<p class="text-red-500 font-semibold p-4">Erro ao pré-visualizar o ficheiro DOCX.</p>' });
                })
                .finally(() => setIsLoadingPreview(false));
        } catch (err) {
            console.error("Error processing docx", err);
            setPreviewContent({ type: 'html', content: '<p class="text-red-500 font-semibold p-4">Erro ao processar o ficheiro .docx.</p>' });
            setIsLoadingPreview(false);
        }
    } else {
        // Reset for images, PDFs which are handled natively by object/img tags
        setPreviewContent(null); 
    }
  }, [viewingAttachment]);

  // --- Handlers ---
  const handleLogin = (success: boolean) => {
    if (success) {
        sessionStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  const handleSectionChange = (docType: DocumentType, id: string, value: string) => {
    if (validationErrors.has(id)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(id);
        return newErrors;
      });
    }

    setAutoSaveStatus('A escrever...');
    const updateFn = docType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
    updateFn(prev => ({ ...prev, [id]: value }));
  };

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

  const handleGenerate = async (docType: DocumentType, sectionId: string, title: string) => {
    const currentSections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    const allSections = docType === 'etp' ? etpSections : trSections;
    setLoadingSection(sectionId);

    let context = '';
    let prompt = '';
    const ragContext = getRagContext();

    if(docType === 'etp') {
      const demandaText = currentSections['etp-input-demanda'] || '';
      if(!demandaText) {
        setMessage({ title: 'Aviso', text: "Por favor, preencha a seção '2. Demanda' primeiro, pois ela serve de base para as outras." });
        setValidationErrors(new Set(['etp-input-demanda']));
        setLoadingSection(null);
        return;
      }
      context = `Contexto Principal (Demanda): ${demandaText}\n`;
      allSections.forEach(sec => {
        const content = currentSections[sec.id];
        if (sec.id !== sectionId && typeof content === 'string' && content.trim()) {
          context += `\nContexto Adicional (${sec.title}): ${content.trim()}\n`;
        }
      });
      prompt = `Você é um especialista em planeamento de contratações públicas no Brasil. Sua tarefa é gerar o conteúdo para a seção "${title}" de um Estudo Técnico Preliminar (ETP).\n\nUse o seguinte contexto do formulário como base:\n${context}\n${ragContext}\n\nGere um texto detalhado e tecnicamente correto para a seção "${title}", utilizando a Lei 14.133/21 como referência principal e incorporando as informações do formulário e dos documentos de apoio.`;
    } else { // TR
      if (!loadedEtpForTr) {
        setMessage({ title: 'Aviso', text: 'Por favor, carregue um ETP para usar como contexto antes de gerar o TR.' });
        setLoadingSection(null);
        return;
      }
      context = `--- INÍCIO DO ETP ---\n${loadedEtpForTr.content}\n--- FIM DO ETP ---`;
      allSections.forEach(sec => {
        const content = currentSections[sec.id];
        if (sec.id !== sectionId && typeof content === 'string' && content.trim()) {
          context += `\nContexto Adicional do TR já preenchido (${sec.title}): ${content.trim()}\n`;
        }
      });
      prompt = `Você é um especialista em licitações públicas no Brasil. Sua tarefa é gerar o conteúdo para a seção "${title}" de um Termo de Referência (TR).\n\nPara isso, utilize as seguintes fontes de informação, em ordem de prioridade:\n1. O Estudo Técnico Preliminar (ETP) base.\n2. Os documentos de apoio (RAG) fornecidos.\n3. O conteúdo já preenchido em outras seções do TR.\n\n${context}\n${ragContext}\n\nGere um texto detalhado e bem fundamentado para a seção "${title}" do TR, extraindo e inferindo as informações necessárias das fontes fornecidas.`;
    }

    try {
      const generatedText = await callGemini(prompt);
      if (generatedText && !generatedText.startsWith("Erro:")) {
        handleSectionChange(docType, sectionId, generatedText);
      } else {
        setMessage({ title: 'Erro de Geração', text: generatedText });
      }
    } catch (error: any) {
      setMessage({ title: 'Erro Inesperado', text: `Falha ao gerar texto: ${error.message}` });
    } finally {
        setLoadingSection(null);
    }
  };

  const validateForm = (docType: DocumentType, sections: Record<string, string>): string[] => {
    const errors: string[] = [];
    const errorFields = new Set<string>();

    const requiredFields: { [key in DocumentType]?: { id: string; name: string }[] } = {
        etp: [
            { id: 'etp-input-demanda', name: '2. Demanda' },
        ],
        tr: [
            { id: 'tr-input-objeto', name: '1. Objeto da Contratação' },
        ],
    };

    const fieldsToValidate = requiredFields[docType] || [];

    fieldsToValidate.forEach(field => {
        // FIX: Safely call .trim() by ensuring the value from sections is treated as a string.
        if (!sections[field.id] || String(sections[field.id] || '').trim() === '') {
            errors.push(`O campo "${field.name}" é obrigatório.`);
            errorFields.add(field.id);
        }
    });

    setValidationErrors(errorFields);
    return errors;
  };

  const handleSaveDocument = (docType: DocumentType) => {
    const sections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    
    const validationMessages = validateForm(docType, sections);
    if (validationMessages.length > 0) {
        setMessage({
            title: "Campos Obrigatórios",
            text: `Por favor, preencha os seguintes campos antes de salvar:\n- ${validationMessages.join('\n- ')}`
        });
        return;
    }

    const name = `${docType.toUpperCase()} ${new Date().toLocaleString('pt-BR').replace(/[/:,]/g, '_')}`;
    const now = new Date().toISOString();
    
    if (docType === 'etp') {
      const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        createdAt: now,
        updatedAt: now,
        sections: { ...sections },
        attachments: etpAttachments,
        history: [],
        priority: 'medium',
      };
      const updatedETPs = [...savedETPs, newDoc];
      setSavedETPs(updatedETPs);
      storage.saveETPs(updatedETPs);
      setMessage({ title: "Sucesso", text: `ETP "${name}" guardado com sucesso!` });
      setPreviewContext({ type: 'etp', id: newDoc.id });
      setIsPreviewModalOpen(true);
    } else {
      const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        createdAt: now,
        updatedAt: now,
        sections: { ...sections },
        attachments: trAttachments,
        history: [],
        priority: 'medium',
      };
      const updatedTRs = [...savedTRs, newDoc];
      setSavedTRs(updatedTRs);
      storage.saveTRs(updatedTRs);
      setMessage({ title: "Sucesso", text: `TR "${name}" guardado com sucesso!` });
      setPreviewContext({ type: docType, id: newDoc.id });
      setIsPreviewModalOpen(true);
    }
  };
  
  const handleLoadDocument = (docType: DocumentType, id: number) => {
    const docs = docType === 'etp' ? savedETPs : savedTRs;
    const docToLoad = docs.find(doc => doc.id === id);
    if(docToLoad) {
      if (docType === 'etp') {
        setEtpSectionsContent(docToLoad.sections);
        setEtpAttachments(docToLoad.attachments || []);
        storage.saveFormState('etpFormState', docToLoad.sections);
      } else {
        setTrSectionsContent(docToLoad.sections);
        setTrAttachments(docToLoad.attachments || []);
        storage.saveFormState('trFormState', docToLoad.sections);
      }
      setMessage({ title: 'Documento Carregado', text: `O ${docType.toUpperCase()} "${docToLoad.name}" foi carregado.` });
      setActiveView(docType);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleDeleteDocument = (docType: DocumentType, id: number) => {
    if (docType === 'etp') {
      const updated = savedETPs.filter(doc => doc.id !== id);
      setSavedETPs(updated);
      storage.saveETPs(updated);
    } else {
      const updated = savedTRs.filter(doc => doc.id !== id);
      setSavedTRs(updated);
      storage.saveTRs(updated);
    }
  };

  const handleStartEditing = (type: DocumentType, doc: SavedDocument) => {
    setEditingDoc({ type, id: doc.id, name: doc.name, priority: doc.priority || 'medium' });
  };

  const handleUpdateDocumentDetails = () => {
    if (!editingDoc) return;

    const { type, id, name, priority } = editingDoc;
    const newName = name.trim();
    if (!newName) {
        setEditingDoc(null); // Cancel edit if name is empty
        return;
    }

    const updateDocs = (docs: SavedDocument[]) => docs.map(doc =>
        doc.id === id ? { ...doc, name: newName, priority: priority } : doc
    );

    if (type === 'etp') {
        const updated = updateDocs(savedETPs);
        setSavedETPs(updated);
        storage.saveETPs(updated);
    } else { // type === 'tr'
        const updated = updateDocs(savedTRs);
        setSavedTRs(updated);
        storage.saveTRs(updated);
    }

    setEditingDoc(null);
  };

  const handleEditorBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // When focus moves from an element inside the div to another element inside the same div,
    // relatedTarget will be one of the children.
    // If focus moves outside the div, relatedTarget will be null or an element outside the div.
    // `contains` will correctly handle both cases.
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      handleUpdateDocumentDetails();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // FIX: Explicitly type `fileList` as `File[]` to resolve type inference issues with `Array.from(FileList)`.
    const fileList: File[] = Array.from(files);

    const filesToProcess = fileList.map(file => ({
      name: file.name,
      status: 'processing' as const,
      message: ''
    }));
    setProcessingFiles(filesToProcess);

    const successfullyProcessed: UploadedFile[] = [];
    const currentFileNames = uploadedFiles.map(f => f.name);

    for (const file of fileList) {
      try {
        const processedFile = await processSingleUploadedFile(file, [
          ...currentFileNames, 
          ...successfullyProcessed.map(f => f.name)
        ]);
        successfullyProcessed.push(processedFile);

        setProcessingFiles(prev =>
          prev.map(p => (p.name === file.name ? { ...p, status: 'success' } : p))
        );
      } catch (error: any) {
        setProcessingFiles(prev =>
          prev.map(p =>
            p.name === file.name ? { ...p, status: 'error', message: error.message } : p
          )
        );
      }
    }

    if (successfullyProcessed.length > 0) {
      const updatedFiles = [...uploadedFiles, ...successfullyProcessed];
      setUploadedFiles(updatedFiles);
      storage.saveStoredFiles(updatedFiles.filter(f => !f.isCore));
    }

    setTimeout(() => {
      setProcessingFiles([]);
    }, 5000);

    event.target.value = ''; // Reset input
  };
  
  const handleToggleFileSelection = (index: number) => {
    if (uploadedFiles[index]?.isCore) return; // Prevent toggling core files
    const updatedFiles = uploadedFiles.map((file, i) =>
      i === index ? { ...file, selected: !file.selected } : file
    );
    setUploadedFiles(updatedFiles);
    storage.saveStoredFiles(updatedFiles.filter(f => !f.isCore));
  };

  const handleDeleteFile = (index: number) => {
      if(uploadedFiles[index]?.isCore) return;
      const updatedFiles = uploadedFiles.filter((_, i) => i !== index);
      setUploadedFiles(updatedFiles);
      storage.saveStoredFiles(updatedFiles.filter(f => !f.isCore));
  };

  const handleLoadEtpForTr = (etpId: string) => {
    if (etpId === "") {
        setLoadedEtpForTr(null);
        return;
    }
    const etp = savedETPs.find(e => e.id === parseInt(etpId, 10));
    if (etp) {
        const content = etpSections
            .map(section => `## ${section.title}\n${etp.sections[section.id] || 'Não preenchido.'}`)
            .join('\n\n');
        setLoadedEtpForTr({ id: etp.id, name: etp.name, content });
    }
  };

  const handleImportEtpAttachments = () => {
    if (!loadedEtpForTr) {
      setMessage({ title: 'Aviso', text: 'Nenhum ETP carregado para importar anexos.' });
      return;
    }
    const etp = savedETPs.find(e => e.id === loadedEtpForTr.id);
    if (etp && etp.attachments && etp.attachments.length > 0) {
      const newAttachments = etp.attachments.filter(
        att => !trAttachments.some(trAtt => trAtt.name === att.name)
      );
      if (newAttachments.length > 0) {
        setTrAttachments(prev => [...prev, ...newAttachments]);
        setMessage({ title: 'Sucesso', text: `${newAttachments.length} anexo(s) importado(s) do ETP "${etp.name}".` });
      } else {
        setMessage({ title: 'Informação', text: 'Todos os anexos do ETP já constam neste TR.' });
      }
    } else {
      setMessage({ title: 'Aviso', text: `O ETP "${loadedEtpForTr.name}" não possui anexos para importar.` });
    }
  };

  const handleRiskAnalysis = async (docType: DocumentType, sectionId: string, title: string) => {
    const currentSections = docType === 'etp' ? etpSectionsContent : trSectionsContent;
    const sectionContent = currentSections[sectionId];

    if (!sectionContent || String(sectionContent || '').trim() === '') {
        setMessage({ title: 'Aviso', text: `Por favor, preencha ou gere o conteúdo da seção "${title}" antes de realizar a análise de riscos.` });
        return;
    }

    setAnalysisContent({ title: `Analisando Riscos para: ${title}`, content: 'A IA está a pensar... por favor, aguarde.' });

    const ragContext = getRagContext();
    let primaryContext = '';
    
    if (docType === 'tr') {
        let etpContext = '';
        if (loadedEtpForTr) {
            etpContext = `--- INÍCIO DO ETP DE CONTEXTO ---\n${loadedEtpForTr.content}\n--- FIM DO ETP DE CONTEXTO ---\n\n`;
        }

        const trOtherSectionsContext = Object.entries(currentSections)
            // FIX: Safely call .trim() by ensuring value is a string.
            .filter(([key, value]) => key !== sectionId && value && String(value || '').trim())
            // FIX: Safely call .trim() by ensuring value is a string.
            .map(([key, value]) => `Contexto da Seção do TR (${trSections.find(s => s.id === key)?.title}):\n${String(value || '').trim()}`)
            .join('\n\n');
        
        primaryContext = `${etpContext}${trOtherSectionsContext}`;
        
    } else if (docType === 'etp') {
        primaryContext = Object.entries(currentSections)
            .filter(([key, value]) => key !== sectionId && value)
            // FIX: Safely call .trim() by ensuring value is a string.
            .map(([key, value]) => `Contexto Adicional (${etpSections.find(s => s.id === key)?.title}): ${String(value || '').trim()}`)
            .join('\n');
    }

    const prompt = `Você é um especialista em gestão de riscos em contratações públicas no Brasil. Sua tarefa é analisar a seção "${title}" de um ${docType.toUpperCase()} e identificar potenciais riscos.

Use o contexto do documento e os documentos de apoio fornecidos.

**Seção a ser analisada:**
${sectionContent}

**Contexto Adicional (Outras seções, ETP, etc.):**
${primaryContext}
${ragContext}

**Sua Tarefa:**
1.  **Identifique Riscos:** Liste de 3 a 5 riscos potenciais relacionados ao conteúdo da seção analisada.
2.  **Classifique os Riscos:** Para cada risco, classifique a Probabilidade (Baixa, Média, Alta) e o Impacto (Baixo, Médio, Alto).
3.  **Sugira Medidas de Mitigação:** Para cada risco, proponha uma ou duas ações concretas para mitigar ou eliminar o risco.

Formate a sua resposta de forma clara e organizada, usando títulos para cada risco.`;

    try {
        const analysisResult = await callGemini(prompt);
        setAnalysisContent({ title: `Análise de Riscos: ${title}`, content: analysisResult });
    } catch (error: any) {
        setAnalysisContent({ title: `Análise de Riscos: ${title}`, content: `Erro ao realizar análise: ${error.message}` });
    }
  };

  const handleOpenEditModal = (docType: DocumentType, sectionId: string, title: string) => {
    const content = (docType === 'etp' ? etpSectionsContent : trSectionsContent)[sectionId] || '';
    setEditingContent({ docType, sectionId, title, text: content });
    setIsEditModalOpen(true);
  };
  
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingContent(null);
    setRefinePrompt('');
    setIsRefining(false);
  };
  
  const handleSaveChanges = () => {
    if (!editingContent) return;
    const { docType, sectionId, text } = editingContent;
    handleSectionChange(docType, sectionId, text);
    closeEditModal();
  };
  
  const handleRefineText = async () => {
    if (!editingContent || !refinePrompt) return;
    setIsRefining(true);
    
    const prompt = `Você é um assistente de redação especializado em documentos públicos. Refine o texto a seguir com base na solicitação do usuário. Retorne apenas o texto refinado, sem introduções ou observações.

--- INÍCIO DO TEXTO ORIGINAL ---
${editingContent.text}
--- FIM DO TEXTO ORIGINAL ---

Solicitação do usuário: "${refinePrompt}"

--- TEXTO REFINADO ---`;

    try {
      const refinedText = await callGemini(prompt);
      if (refinedText && !refinedText.startsWith("Erro:")) {
        setEditingContent({ ...editingContent, text: refinedText });
      } else {
        setMessage({ title: "Erro de Refinamento", text: refinedText });
      }
    } catch (error: any) {
      setMessage({ title: 'Erro Inesperado', text: `Falha ao refinar o texto: ${error.message}` });
    } finally {
      setIsRefining(false);
    }
  };

  const handleExportToPDF = () => {
    if (!previewContext.type || previewContext.id === null) return;

    const { type, id } = previewContext;
    const docs = type === 'etp' ? savedETPs : savedTRs;
    const docToExport = docs.find(d => d.id === id);

    if (docToExport) {
        const allSections = type === 'etp' ? etpSections : trSections;
        exportDocumentToPDF(docToExport, allSections);
    } else {
        setMessage({ title: 'Erro', text: 'Não foi possível encontrar o documento para exportar.' });
    }
  };
  
  const handleClearForm = useCallback((docType: DocumentType) => () => {
    if (docType === 'etp') {
        setEtpSectionsContent({});
        setEtpAttachments([]);
        storage.saveFormState('etpFormState', {});
    } else {
        setTrSectionsContent({});
        setTrAttachments([]);
        setLoadedEtpForTr(null);
        const etpSelector = document.getElementById('etp-selector') as HTMLSelectElement;
        if (etpSelector) etpSelector.value = "";
        storage.saveFormState('trFormState', {});
    }
    setMessage({ title: 'Formulário Limpo', text: `O formulário do ${docType.toUpperCase()} foi limpo.` });
  }, []);

  const getAttachmentDataUrl = (attachment: Attachment) => {
    return `data:${attachment.type};base64,${attachment.content}`;
  };
  
  const handleGenerateSummary = async () => {
      if (!previewContext.type || previewContext.id === null) return;

      const { type, id } = previewContext;
      const docs = type === 'etp' ? savedETPs : savedTRs;
      const doc = docs.find(d => d.id === id);

      if (!doc) {
        setMessage({ title: 'Erro', text: 'Documento não encontrado para gerar o resumo.' });
        return;
      }

      setSummaryState({ loading: true, content: null });

      const allSections = type === 'etp' ? etpSections : trSections;
      const documentText = allSections
        .map(section => {
          const content = doc.sections[section.id];
          if (content && String(content).trim()) {
            return `### ${section.title}\n${content}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      if (!documentText.trim()) {
        setSummaryState({ loading: false, content: 'O documento está vazio e não pode ser resumido.' });
        return;
      }
      
      const ragContext = getRagContext();

      const prompt = `Você é um assistente especializado em analisar documentos de licitações públicas. Sua tarefa é criar um resumo executivo do "Documento Principal" a seguir. Utilize os "Documentos de Apoio (RAG)" como contexto para entender melhor o tema.

      O resumo deve ser conciso, focar APENAS nas informações do "Documento Principal" e destacar os seguintes pontos:
      1.  O objetivo principal da contratação.
      2.  Os elementos ou requisitos mais importantes.
      3.  A conclusão ou solução recomendada.

      Seja direto e claro. O resumo não deve exceder 200 palavras.

      --- INÍCIO DO DOCUMENTO PRINCIPAL ---
      ${documentText}
      --- FIM DO DOCUMENTO PRINCIPAL ---
      
      ${ragContext}

      --- RESUMO EXECUTIVO ---`;

      try {
        const summary = await callGemini(prompt);
        if (summary && !summary.startsWith("Erro:")) {
          setSummaryState({ loading: false, content: summary });
        } else {
          setSummaryState({ loading: false, content: `Erro ao gerar resumo: ${summary}` });
        }
      } catch (error: any) {
        setSummaryState({ loading: false, content: `Falha inesperada ao gerar resumo: ${error.message}` });
      }
    };

  const renderPreviewContent = () => {
    if (!previewContext.type || previewContext.id === null) return null;
    const { type, id } = previewContext;
    const docs = type === 'etp' ? savedETPs : savedTRs;
    const doc = docs.find(d => d.id === id);
    if (!doc) return <p>Documento não encontrado.</p>;

    const allSections = type === 'etp' ? etpSections : trSections;

    return (
      <div>
        <div className="pb-4 border-b border-slate-200 mb-6">
            <div className="flex justify-between items-start flex-wrap gap-y-3">
              <div>
                  <h1 className="text-3xl font-extrabold text-slate-800 leading-tight">{doc.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-2">
                      <span><Icon name="calendar-plus" className="mr-1.5" /> Criado em: {new Date(doc.createdAt).toLocaleString('pt-BR')}</span>
                      {doc.updatedAt && doc.updatedAt !== doc.createdAt && (
                      <span><Icon name="calendar-check" className="mr-1.5" /> Última modif.: {new Date(doc.updatedAt).toLocaleString('pt-BR')}</span>
                      )}
                  </div>
              </div>
               <button
                  onClick={handleGenerateSummary}
                  disabled={summaryState.loading}
                  className="flex items-center gap-2 bg-purple-100 text-purple-700 font-bold py-2 px-4 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <Icon name="wand-magic-sparkles" />
                  {summaryState.loading ? 'A resumir...' : 'Gerar Resumo com IA'}
               </button>
            </div>
             {(summaryState.loading || summaryState.content) && (
                <div className="mt-6 p-4 bg-purple-50 border-l-4 border-purple-400 rounded-r-lg">
                    <h3 className="font-bold text-purple-800 text-lg mb-2">Resumo Executivo</h3>
                    {summaryState.loading ? (
                        <div className="flex items-center gap-2 text-purple-700">
                            <Icon name="spinner" className="fa-spin" />
                            <span>A IA está a processar o seu pedido...</span>
                        </div>
                    ) : (
                        <p className="text-purple-900 whitespace-pre-wrap">{summaryState.content}</p>
                    )}
                </div>
            )}
        </div>
        
        <div className="space-y-8">
          {allSections.map(section => {
            const content = doc.sections[section.id];
            // FIX: Safely call .trim() by ensuring content is a string.
            if (content && String(content || '').trim()) {
              return (
                <div key={section.id}>
                  <h2 className="text-xl font-bold text-slate-700 mb-3">{section.title}</h2>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="whitespace-pre-wrap text-slate-800 font-sans leading-relaxed text-base">
                      {content}
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        {doc.attachments && doc.attachments.length > 0 && (
            <div className="mt-8">
                <h2 className="text-xl font-bold text-slate-700 mb-3">Anexos</h2>
                <div className="space-y-3">
                    {doc.attachments.map((att, index) => (
                        <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                  <Icon name="file-alt" className="text-slate-500" />
                                  <span className="font-medium text-slate-800 truncate">{att.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                  <button 
                                      onClick={() => viewingAttachment?.name === att.name ? setViewingAttachment(null) : setViewingAttachment(att)} 
                                      className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                                  >
                                      {viewingAttachment?.name === att.name ? 'Ocultar' : 'Visualizar'}
                                  </button>
                              </div>
                          </div>
                          {att.description && (
                              <div className="mt-2 pl-4 ml-6 border-l-2 border-slate-200">
                                <p className="text-sm text-slate-600 italic">"{att.description}"</p>
                              </div>
                          )}
                      </div>
                    ))}
                </div>
            </div>
        )}
        
        {viewingAttachment && (
            <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 truncate" title={viewingAttachment.name}>Visualizando: {viewingAttachment.name}</h3>
                    <button onClick={() => setViewingAttachment(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full">
                        <Icon name="times" className="text-xl" />
                    </button>
                </div>
                <div className="w-full h-[60vh] bg-slate-100 rounded-lg border flex items-center justify-center">
                    {isLoadingPreview ? (
                        <div className="flex flex-col items-center gap-2 text-slate-600">
                            <Icon name="spinner" className="fa-spin text-3xl" />
                            <span>A carregar pré-visualização...</span>
                        </div>
                    ) : previewContent ? (
                        <div className="w-full h-full bg-white overflow-auto rounded-lg">
                            {previewContent.type === 'text' ? (
                                <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-6 h-full">{previewContent.content}</pre>
                            ) : (
                                <div className="p-2 sm:p-8 bg-slate-100 min-h-full">
                                    <div className="prose max-w-4xl mx-auto p-8 bg-white shadow-lg" dangerouslySetInnerHTML={{ __html: previewContent.content }} />
                                </div>
                            )}
                        </div>
                    ) : viewingAttachment.type.startsWith('image/') ? (
                        <img src={getAttachmentDataUrl(viewingAttachment)} alt={viewingAttachment.name} className="max-w-full max-h-full object-contain" />
                    ) : viewingAttachment.type === 'application/pdf' ? (
                        <object data={getAttachmentDataUrl(viewingAttachment)} type="application/pdf" width="100%" height="100%">
                            <p className="p-4 text-center text-slate-600">O seu navegador não suporta a pré-visualização de PDFs. <a href={getAttachmentDataUrl(viewingAttachment)} download={viewingAttachment.name} className="text-blue-600 hover:underline">Clique aqui para fazer o download.</a></p>
                        </object>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <Icon name="file-download" className="text-5xl text-slate-400 mb-4" />
                            <p className="text-slate-700 text-lg mb-2">A pré-visualização não está disponível para este tipo de ficheiro.</p>
                            <p className="text-slate-500 mb-6 text-sm">({viewingAttachment.type})</p>
                            <a 
                                href={getAttachmentDataUrl(viewingAttachment)} 
                                download={viewingAttachment.name}
                                className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Icon name="download" />
                                Fazer Download
                            </a>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    );
  };

  const switchView = useCallback((view: DocumentType) => {
    setActiveView(view);
    setValidationErrors(new Set());
  }, []);

  const toggleSidebarSection = (section: 'etps' | 'trs' | 'rag') => {
    setOpenSidebarSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const handleCreateNewDocument = useCallback((docType: DocumentType) => {
    setIsNewDocModalOpen(false);
    switchView(docType);
    handleClearForm(docType)();
    setMessage({
        title: 'Novo Documento',
        text: `Um novo formulário para ${docType.toUpperCase()} foi iniciado.`
    });
  }, [switchView, handleClearForm]);

  // PWA Shortcut Handler
  useEffect(() => {
    if (!isAuthenticated) return;

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'new-etp' || action === 'new-tr') {
      const docType = action === 'new-etp' ? 'etp' : 'tr';
      handleCreateNewDocument(docType);
      // Clean up URL to prevent re-triggering on reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isAuthenticated, handleCreateNewDocument]);

  const displayDocumentHistory = (doc: SavedDocument) => {
    setHistoryModalContent(doc);
  };
  
  const handleInstallClick = () => {
    if (!installPrompt) {
        return;
    }
    installPrompt.prompt();
    installPrompt.userChoice.then(({ outcome }: { outcome: 'accepted' | 'dismissed' }) => {
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setInstallPrompt(null);
        setIsInstallBannerVisible(false);
    });
  };

  const handleDismissInstallBanner = () => {
    sessionStorage.setItem('pwaInstallDismissed', 'true');
    setIsInstallBannerVisible(false);
  };

  const handleShare = async () => {
    const shareData = {
        title: 'TR Genius PWA',
        text: 'Conheça o TR Genius, seu assistente IA para licitações!',
        url: 'https://trgenius.netlify.app/'
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            console.error('Erro ao partilhar:', error);
        }
    } else {
        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(shareData.url);
            setMessage({ title: "Link Copiado", text: "O link da aplicação foi copiado para a sua área de transferência!" });
        } catch (error) {
            console.error('Erro ao copiar o link:', error);
            setMessage({ title: "Erro", text: "Não foi possível copiar o link. Por favor, copie manualmente: https://trgenius.netlify.app/" });
        }
    }
  };

  const { displayedETPs, displayedTRs } = useMemo(() => {
    const processDocuments = (docs: SavedDocument[]) => {
      const filtered = docs.filter(doc =>
        (priorityFilter === 'all' || doc.priority === priorityFilter) &&
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      const sorted = [...filtered].sort((a, b) => {
        if (sortOrder === 'name') {
          return a.name.localeCompare(b.name);
        }
        // Default sort by 'updatedAt' descending
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      return sorted;
    };
    
    return {
      displayedETPs: processDocuments(savedETPs),
      displayedTRs: processDocuments(savedTRs)
    };
  }, [savedETPs, savedTRs, priorityFilter, searchTerm, sortOrder]);

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 font-sans">
       <div className="flex flex-col md:flex-row h-screen">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-10 transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}
          
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden fixed top-4 left-4 z-30 bg-blue-600 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center">
            <Icon name={isSidebarOpen ? 'times' : 'bars'} />
          </button>
         
          <aside className={`fixed md:relative top-0 left-0 h-full w-full max-w-sm md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col