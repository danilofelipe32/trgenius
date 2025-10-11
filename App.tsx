import React, { useState, useEffect, useCallback } from 'react';
import { Section as SectionType, SavedDocument, UploadedFile, DocumentType, PreviewContext, Attachment } from './types';
import * as storage from './services/storageService';
import { callGemini } from './services/geminiService';
import { processSingleUploadedFile, chunkText } from './services/ragService';
import { exportDocumentToPDF } from './services/exportService';
import { Icon } from './components/Icon';

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
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
            <label htmlFor={id} className={`block text-lg font-semibold ${hasError ? 'text-red-600' : 'text-slate-700'}`}>{title}</label>
            {tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={tooltip} />}
        </div>
        <div className="flex items-center gap-2">
           {value && value.trim().length > 0 && onEdit && (
             <button
              onClick={onEdit}
              className="px-3 py-1 text-xs font-semibold text-green-600 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
              title="Editar e Refinar"
            >
              <Icon name="pencil-alt" className="mr-1" /> Editar
            </button>
          )}
          {hasRiskAnalysis && onAnalyze && (
            <button
              onClick={onAnalyze}
              className="px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
              title="Análise de Riscos"
            >
              <Icon name="shield-alt" className="mr-1" /> Análise de Risco
            </button>
          )}
          {hasGen && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="wand-magic-sparkles" className="mr-1" /> {isLoading ? 'A gerar...' : 'Gerar com IA'}
            </button>
          )}
        </div>
      </div>
      <textarea
        id={id}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={isLoading ? 'A IA está a gerar o conteúdo...' : placeholder}
        className={`w-full h-40 p-3 bg-slate-50 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors ${hasError ? 'border-red-500 ring-red-200' : 'border-slate-200 focus:ring-blue-500'}`}
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


// --- Main App Component ---
const App: React.FC = () => {
  const [activeView, setActiveView] = useState<DocumentType>('etp');
  
  // State for documents
  const [savedETPs, setSavedETPs] = useState<SavedDocument[]>([]);
  const [savedTRs, setSavedTRs] = useState<SavedDocument[]>([]);
  const [etpSectionsContent, setEtpSectionsContent] = useState<Record<string, string>>({});
  const [trSectionsContent, setTrSectionsContent] = useState<Record<string, string>>({});
  const [etpAttachments, setEtpAttachments] = useState<Attachment[]>([]);
  const [loadedEtpForTr, setLoadedEtpForTr] = useState<{ name: string; content: string } | null>(null);

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
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<{ docType: DocumentType; sectionId: string; title: string; text: string } | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Inline rename state
  const [editingDoc, setEditingDoc] = useState<{ type: DocumentType; id: number } | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  
  // Sections definitions
  const etpSections: SectionType[] = [
    { id: 'etp-input-introducao', title: '1. Introdução', placeholder: 'Apresentação do objetivo da contratação, justificativa e contexto...', hasGen: true, tooltip: "Conforme Art. 6º, XVII, da Lei 14.133/21, o ETP caracteriza o interesse público, a melhor solução e serve de base para o Termo de Referência. Descreva aqui o objetivo e o contexto da contratação." },
    { id: 'etp-input-demanda', title: '2. Demanda', placeholder: 'Descrição detalhada da necessidade a ser atendida pela contratação...', hasGen: true, tooltip: "Detalhe a necessidade da Administração que motiva esta contratação. Inclua a avaliação da demanda do público-alvo e a motivação técnico-econômico-social, como previsto no Art. 6º, XIX, a)." },
    { id: 'etp-input-analise-demanda', title: '3. Análise da Demanda', placeholder: 'Avaliação da necessidade, incluindo levantamento de dados e informações relevantes...', hasGen: true, tooltip: "Aprofunde a avaliação da necessidade, levantando dados e informações relevantes que justifiquem a contratação e seus quantitativos." },
    { id: 'etp-input-levantamento-solucoes', title: '4. Levantamento de Soluções', placeholder: 'Identificação de possíveis soluções para atender à demanda...', hasGen: true, tooltip: "Identifique e descreva as diferentes soluções de mercado (produtos, serviços, tecnologias) que podem atender à demanda apresentada." },
    { id: 'etp-input-analise-solucoes', title: '5. Análise das Soluções', placeholder: 'Avaliação detalhada de cada solução identificada...', hasGen: true, tooltip: "Avalie criticamente cada solução levantada, considerando aspectos técnicos, econômicos, de sustentabilidade e de viabilidade para a Administração." },
    { id: 'etp-input-recomendacao', title: '6. Recomendação da Solução', placeholder: 'Indicação da solução mais adequada para a contratação...', hasGen: true, tooltip: "Com base na análise, indique e justifique qual a solução mais vantajosa e adequada para a contratação, explicando os motivos da escolha." },
    { id: 'etp-input-anexos', title: '7. Anexos', placeholder: 'Liste aqui referências a documentos complementares ou adicione notas sobre os ficheiros anexados...', hasGen: false, tooltip: "Inclua aqui referências a documentos complementares como pesquisas de mercado, planilhas de custos, cronogramas ou outros estudos relevantes.", isAttachmentSection: true }
  ];

  const trSections: SectionType[] = [
    { id: 'tr-input-objeto', title: '1. Objeto da Contratação', placeholder: 'Ex: Aquisição de 50 notebooks, com garantia de 24 meses...', hasGen: true, hasRiskAnalysis: true, tooltip: "Conforme Art. 40, I, defina de forma precisa, suficiente e clara o que será contratado, incluindo natureza, quantitativos, prazo e, se houver, possibilidade de prorrogação." },
    { id: 'tr-input-justificativa', title: '2. Justificativa e Quantitativos', placeholder: 'Ex: A contratação visa substituir equipamentos obsoletos...', hasGen: true, tooltip: "Fundamente a necessidade da contratação, fazendo referência ao Estudo Técnico Preliminar (ETP) e justificando os quantitativos solicitados. (Art. 40, II)." },
    { id: 'tr-input-execucao', title: '3. Condições de Execução e Garantia', placeholder: 'Ex: Entrega única em até 30 dias corridos...', hasGen: true, tooltip: "Descreva o modelo de execução do objeto, detalhando como, onde e quando o serviço será prestado ou o bem será entregue, incluindo prazos e garantias. (Art. 40, V, c))." },
    { id: 'tr-input-obrigacoes', title: '4. Obrigações das Partes', placeholder: 'Ex: Contratada: Fornecer bens novos... Contratante: Efetuar o pagamento...', hasGen: true, tooltip: "Liste os deveres e responsabilidades tanto da empresa contratada quanto da Administração (contratante) durante a vigência do contrato. (Art. 40, V, f))." },
    { id: 'tr-input-habilitacao', title: '5. Requisitos de Qualificação Técnica', placeholder: 'Ex: Apresentar Atestado de Capacidade Técnica...', hasGen: true, tooltip: "Especifique os requisitos técnicos que a empresa licitante deve comprovar para demonstrar sua capacidade de executar o objeto do contrato. (Art. 40, V, d))." },
    { id: 'tr-input-pagamento', title: '6. Modelo de Pagamento e Dotação', placeholder: 'Ex: Pagamento em parcela única, em até 30 dias...', hasGen: true, tooltip: "Defina os critérios e o modelo de pagamento, incluindo prazos, condições e a dotação orçamentária que cobrirá a despesa. (Art. 40, V, e))." },
    { id: 'tr-input-fiscalizacao', title: '7. Gestão e Fiscalização do Contrato', placeholder: 'Ex: A fiscalização será exercida por servidor(a) designado(a)...', hasGen: true, tooltip: "Estabeleça os mecanismos de fiscalização e gestão do contrato, indicando os responsáveis e como será feito o acompanhamento da execução. (Art. 40, V, g))." },
    { id: 'tr-input-sancoes', title: '8. Sanções Administrativas', placeholder: 'Ex: O descumprimento das cláusulas sujeitará a contratada...', hasGen: true, tooltip: "Determine as sanções aplicáveis em caso de inadimplemento ou descumprimento das obrigações contratuais por parte da contratada. (Art. 40, V, h))." }
  ];


  // --- Effects ---
  useEffect(() => {
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
            const response = await fetch('./lei14133.json');
            if (!response.ok) throw new Error('Falha ao carregar a base de conhecimento.');

            const lawData: { page: number; content: string }[] = await response.json();
            const fullText = lawData.map(item => item.content).join('\n\n');
            const chunks = chunkText(fullText);

            const lawFile: UploadedFile = {
                name: 'Lei 14.133/21 (Base de Conhecimento)',
                chunks,
                selected: true,
                isCore: true
            };
            
            const existingUserFiles = userFiles.filter(f => !f.isCore);
            setUploadedFiles([lawFile, ...existingUserFiles]);

        } catch (error) {
            console.error("Erro ao carregar a base de conhecimento:", error);
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
  }, []);

  // --- Handlers ---
  const handleSectionChange = (docType: DocumentType, id: string, value: string) => {
    if (validationErrors.has(id)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(id);
        return newErrors;
      });
    }

    const updateFn = docType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
    updateFn(prev => {
        const newState = { ...prev, [id]: value };
        storage.saveFormState(docType === 'etp' ? 'etpFormState' : 'trFormState', newState);
        return newState;
    });
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
        const updateFn = docType === 'etp' ? setEtpSectionsContent : setTrSectionsContent;
        updateFn(prev => {
          const newState = {...prev, [sectionId]: generatedText};
          storage.saveFormState(docType === 'etp' ? 'etpFormState' : 'trFormState', newState);
          return newState;
        });
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
        if (!sections[field.id] || sections[field.id].trim() === '') {
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
    
    if (docType === 'etp') {
      const newDoc: SavedDocument = {
        id: Date.now(),
        name,
        createdAt: new Date().toISOString(),
        sections: { ...sections },
        attachments: etpAttachments,
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
        createdAt: new Date().toISOString(),
        sections: { ...sections }
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
    setEditingDoc({ type, id: doc.id });
    setEditingDocName(doc.name);
  };

  const handleRenameDocument = () => {
    if (!editingDoc || !editingDocName.trim()) {
        setEditingDoc(null); // Cancel edit if name is empty
        return;
    }

    const { type, id } = editingDoc;
    const newName = editingDocName.trim();

    if (type === 'etp') {
        const updated = savedETPs.map(doc =>
            doc.id === id ? { ...doc, name: newName } : doc
        );
        setSavedETPs(updated);
        storage.saveETPs(updated);
    } else { // type === 'tr'
        const updated = savedTRs.map(doc =>
            doc.id === id ? { ...doc, name: newName } : doc
        );
        setSavedTRs(updated);
        storage.saveTRs(updated);
    }

    setEditingDoc(null);
    setEditingDocName('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filesToProcess = Array.from(files).map(file => ({
      name: file.name,
      status: 'processing' as const,
      message: ''
    }));
    setProcessingFiles(filesToProcess);

    const successfullyProcessed: UploadedFile[] = [];
    const currentFileNames = uploadedFiles.map(f => f.name);

    for (const file of Array.from(files)) {
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
  };

  const handleEtpAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
        if (etpAttachments.some(att => att.name === file.name)) {
            setMessage({ title: 'Aviso', text: `O ficheiro "${file.name}" já foi anexado.` });
            continue;
        }
        try {
            const base64Content = await fileToBase64(file);
            newAttachments.push({
                name: file.name,
                type: file.type,
                content: base64Content,
            });
        } catch (error) {
            console.error("Error converting file to base64", error);
            setMessage({ title: 'Erro', text: `Não foi possível processar o ficheiro "${file.name}".` });
        }
    }
    setEtpAttachments(prev => [...prev, ...newAttachments]);
    event.target.value = ''; 
  };

  const handleRemoveEtpAttachment = (indexToRemove: number) => {
    setEtpAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
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
        setLoadedEtpForTr({ name: etp.name, content });
    }
  };

  const handleRiskAnalysis = async (sectionId: string, title: string) => {
    if (!loadedEtpForTr) {
        setMessage({ title: 'Aviso', text: 'Por favor, carregue um ETP para usar como contexto para a análise de riscos.' });
        return;
    }
    const sectionContent = trSectionsContent[sectionId];
    if (!sectionContent || sectionContent.trim() === '') {
        setMessage({ title: 'Aviso', text: `Por favor, preencha ou gere o conteúdo da seção "${title}" antes de realizar a análise de riscos.` });
        return;
    }

    setAnalysisContent({ title: `Analisando Riscos para: ${title}`, content: 'A IA está a pensar... por favor, aguarde.' });

    const ragContext = getRagContext();
    const etpContext = `--- INÍCIO DO ETP ---\n${loadedEtpForTr.content}\n--- FIM DO ETP ---`;

    const prompt = `Você é um especialista em gestão de riscos em contratações públicas no Brasil. Sua tarefa é analisar a seção "${title}" de um Termo de Referência (TR) e identificar potenciais riscos.

Use o ETP e os documentos de apoio como contexto.

**Seção a ser analisada:**
${sectionContent}

**Contexto (ETP e Documentos):**
${etpContext}
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

  const handleClearForm = (docType: DocumentType) => () => {
    if (docType === 'etp') {
        setEtpSectionsContent({});
        setEtpAttachments([]);
        storage.saveFormState('etpFormState', {});
    } else {
        setTrSectionsContent({});
        setLoadedEtpForTr(null);
        const etpSelector = document.getElementById('etp-selector') as HTMLSelectElement;
        if (etpSelector) etpSelector.value = "";
        storage.saveFormState('trFormState', {});
    }
    setMessage({ title: 'Formulário Limpo', text: `O formulário do ${docType.toUpperCase()} foi limpo.` });
  };

  const getAttachmentDataUrl = (attachment: Attachment) => {
    return `data:${attachment.type};base64,${attachment.content}`;
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
          <h1 className="text-3xl font-extrabold text-slate-800 leading-tight">{doc.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Criado em: {new Date(doc.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        
        <div className="space-y-8">
          {allSections.map(section => {
            const content = doc.sections[section.id];
            if (content && content.trim()) {
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
                <div className="space-y-2">
                    {doc.attachments.map((att, index) => (
                        <div key={index} className="flex items-center justify-between bg-slate-100 p-2 rounded-lg text-sm">
                            <div className="flex items-center gap-2 truncate">
                                <Icon name="file-alt" className="text-slate-500" />
                                <span className="font-medium text-slate-800 truncate">{att.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => setViewingAttachment(att)} className="text-blue-600 hover:text-blue-800 font-semibold">Visualizar</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    );
  };

  const switchView = (view: DocumentType) => {
    setActiveView(view);
    setValidationErrors(new Set());
  };

  const toggleSidebarSection = (section: 'etps' | 'trs' | 'rag') => {
    setOpenSidebarSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
         
          <aside className={`fixed md:relative top-0 left-0 h-full w-full max-w-sm md:w-80 bg-white border-r border-slate-200 p-6 flex flex-col transition-transform duration-300 z-20 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
             <div className="flex items-center gap-3 mb-6 pt-10 md:pt-0">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                    <Icon name="brain" className="text-pink-600 text-xl" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">TR Genius</h1>
            </div>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Seu assistente para criar Estudos Técnicos e Termos de Referência, em conformidade com a <b>Lei 14.133/21</b>.
            </p>
            
            <div className="flex-1 overflow-y-auto -mr-6 pr-6 space-y-1">
                
                {/* Accordion Section: ETPs */}
                <div className="py-2">
                  <button onClick={() => toggleSidebarSection('etps')} className="w-full flex justify-between items-center text-left">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">ETPs Salvos</h3>
                    <Icon name={openSidebarSections.etps ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                  </button>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.etps ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2">
                      {savedETPs.length > 0 ? (
                        <ul className="space-y-2">
                          {savedETPs.map(etp => (
                            <li key={etp.id} className="group flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                              {editingDoc?.type === 'etp' && editingDoc?.id === etp.id ? (
                                  <input
                                      type="text"
                                      value={editingDocName}
                                      onChange={(e) => setEditingDocName(e.target.value)}
                                      onBlur={handleRenameDocument}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleRenameDocument();
                                          if (e.key === 'Escape') setEditingDoc(null);
                                      }}
                                      className="text-sm font-medium w-full bg-white border border-blue-500 rounded px-1"
                                      autoFocus
                                  />
                              ) : (
                                  <span className="text-sm font-medium text-slate-700 truncate">{etp.name}</span>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleStartEditing('etp', etp)} className="w-6 h-6 text-slate-500 hover:text-yellow-600" title="Renomear"><Icon name="pencil-alt" /></button>
                                <button onClick={() => handleLoadDocument('etp', etp.id)} className="w-6 h-6 text-slate-500 hover:text-blue-600" title="Carregar"><Icon name="upload" /></button>
                                <button onClick={() => { setPreviewContext({ type: 'etp', id: etp.id }); setIsPreviewModalOpen(true); }} className="w-6 h-6 text-slate-500 hover:text-green-600" title="Pré-visualizar"><Icon name="eye" /></button>
                                <button onClick={() => handleDeleteDocument('etp', etp.id)} className="w-6 h-6 text-slate-500 hover:text-red-600" title="Apagar"><Icon name="trash" /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-slate-400 italic px-2">Nenhum ETP salvo.</p>}
                    </div>
                  </div>
                </div>

                {/* Accordion Section: TRs */}
                <div className="py-2">
                  <button onClick={() => toggleSidebarSection('trs')} className="w-full flex justify-between items-center text-left">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">TRs Salvos</h3>
                    <Icon name={openSidebarSections.trs ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                  </button>
                   <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.trs ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2">
                      {savedTRs.length > 0 ? (
                        <ul className="space-y-2">
                          {savedTRs.map(tr => (
                            <li key={tr.id} className="group flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                               {editingDoc?.type === 'tr' && editingDoc?.id === tr.id ? (
                                  <input
                                      type="text"
                                      value={editingDocName}
                                      onChange={(e) => setEditingDocName(e.target.value)}
                                      onBlur={handleRenameDocument}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleRenameDocument();
                                          if (e.key === 'Escape') setEditingDoc(null);
                                      }}
                                      className="text-sm font-medium w-full bg-white border border-blue-500 rounded px-1"
                                      autoFocus
                                  />
                              ) : (
                                  <span className="text-sm font-medium text-slate-700 truncate">{tr.name}</span>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleStartEditing('tr', tr)} className="w-6 h-6 text-slate-500 hover:text-yellow-600" title="Renomear"><Icon name="pencil-alt" /></button>
                                <button onClick={() => handleLoadDocument('tr', tr.id)} className="w-6 h-6 text-slate-500 hover:text-blue-600" title="Carregar"><Icon name="upload" /></button>
                                <button onClick={() => { setPreviewContext({ type: 'tr', id: tr.id }); setIsPreviewModalOpen(true); }} className="w-6 h-6 text-slate-500 hover:text-green-600" title="Pré-visualizar"><Icon name="eye" /></button>
                                <button onClick={() => handleDeleteDocument('tr', tr.id)} className="w-6 h-6 text-slate-500 hover:text-red-600" title="Apagar"><Icon name="trash" /></button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-slate-400 italic px-2">Nenhum TR salvo.</p>}
                    </div>
                   </div>
                </div>

                {/* Accordion Section: RAG */}
                <div className="py-2">
                  <button onClick={() => toggleSidebarSection('rag')} className="w-full flex justify-between items-center text-left">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Documentos de Apoio (RAG)</h3>
                    <Icon name={openSidebarSections.rag ? 'chevron-up' : 'chevron-down'} className="text-slate-400 transition-transform" />
                  </button>
                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSidebarSections.rag ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2">
                      {processingFiles.length > 0 && (
                        <div className="mb-3 p-2 bg-slate-100 rounded-lg">
                          <h4 className="text-xs font-bold text-slate-600 mb-2">A processar ficheiros...</h4>
                           <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${(processingFiles.filter(f => f.status !== 'processing').length / processingFiles.length) * 100}%` }}
                              ></div>
                          </div>
                          <ul className="space-y-1">
                              {processingFiles.map(file => (
                                  <li key={file.name} className="flex items-center text-xs justify-between">
                                    <div className="flex items-center truncate">
                                      {file.status === 'processing' && <Icon name="spinner" className="fa-spin text-slate-400 w-4" />}
                                      {file.status === 'success' && <Icon name="check-circle" className="text-green-500 w-4" />}
                                      {file.status === 'error' && <Icon name="exclamation-circle" className="text-red-500 w-4" />}
                                      <span className="ml-2 truncate flex-1">{file.name}</span>
                                    </div>
                                      {file.status === 'error' && <span className="ml-2 text-red-600 font-semibold flex-shrink-0">{file.message}</span>}
                                  </li>
                              ))}
                          </ul>
                        </div>
                      )}
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 truncate">
                            <input type="checkbox" checked={file.selected} onChange={() => handleToggleFileSelection(index)} className="form-checkbox h-4 w-4 text-blue-600 rounded" />
                            <span className="truncate">{file.name}</span>
                            {file.isCore && <Icon name="lock" className="text-slate-400 text-xs" title="Base de Conhecimento Principal" />}
                          </label>
                          {!file.isCore && (
                              <button onClick={() => handleDeleteFile(index)} className="w-6 h-6 text-slate-500 hover:text-red-600 flex-shrink-0"><Icon name="trash" /></button>
                          )}
                        </div>
                      ))}
                      <label className="mt-2 w-full flex items-center justify-center px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-200 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                          <Icon name="upload" className="mr-2" />
                          <span className="text-sm font-semibold">Carregar ficheiros</span>
                          <input type="file" className="hidden" multiple onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
                      </label>
                    </div>
                  </div>
                </div>
            </div>
          </aside>
          
          <main className="flex-1 p-6 md:p-10 overflow-y-auto" onClick={() => { if(window.innerWidth < 768) setIsSidebarOpen(false) }}>
             <header className="flex justify-between items-center mb-8">
                <div className="w-full">
                  <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                      <button
                        onClick={() => switchView('etp')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
                          activeView === 'etp'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        Gerador de ETP
                      </button>
                      <button
                        onClick={() => switchView('tr')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
                           activeView === 'tr'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        Gerador de TR
                      </button>
                    </nav>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                    <button onClick={() => setIsInfoModalOpen(true)} className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-blue-600 transition-colors flex items-center justify-center" title="Informações"><Icon name="info-circle" /></button>
                </div>
            </header>
            
            <div className={`${activeView === 'etp' ? 'block' : 'hidden'}`}>
                {etpSections.map(section => {
                  if (section.isAttachmentSection) {
                    return (
                        <div key={section.id} className="bg-white p-6 rounded-xl shadow-sm mb-6 transition-all hover:shadow-md">
                            <div className="flex justify-between items-center mb-3">
                                 <div className="flex items-center gap-2">
                                    <label className="block text-lg font-semibold text-slate-700">{section.title}</label>
                                    {section.tooltip && <Icon name="question-circle" className="text-slate-400 cursor-help" title={section.tooltip} />}
                                 </div>
                            </div>
                            <textarea
                                id={section.id}
                                value={etpSectionsContent[section.id] || ''}
                                onChange={(e) => handleSectionChange('etp', section.id, e.target.value)}
                                placeholder={section.placeholder}
                                className="w-full h-24 p-3 bg-slate-50 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors border-slate-200 focus:ring-blue-500 mb-4"
                            />
                            
                            {etpAttachments.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {etpAttachments.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-slate-100 p-2 rounded-lg text-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <Icon name="file-alt" className="text-slate-500" />
                                                <span className="font-medium text-slate-800 truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button onClick={() => setViewingAttachment(file)} className="text-blue-600 hover:text-blue-800 font-semibold">Visualizar</button>
                                                <button onClick={() => handleRemoveEtpAttachment(index)} className="text-red-600 hover:text-red-800 font-semibold">Remover</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <label className="w-full flex items-center justify-center px-4 py-3 bg-green-50 border-2 border-dashed border-green-200 text-green-700 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                                <Icon name="paperclip" className="mr-2" />
                                <span className="font-semibold">Anexar Ficheiros</span>
                                <input type="file" className="hidden" multiple onChange={handleEtpAttachmentUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*" />
                            </label>
                        </div>
                    );
                  }
                  return (
                    <Section
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        placeholder={section.placeholder}
                        value={etpSectionsContent[section.id]}
                        onChange={(id, value) => handleSectionChange('etp', id, value)}
                        onGenerate={() => handleGenerate('etp', section.id, section.title)}
                        hasGen={section.hasGen}
                        isLoading={loadingSection === section.id}
                        onEdit={() => handleOpenEditModal('etp', section.id, section.title)}
                        hasError={validationErrors.has(section.id)}
                        tooltip={section.tooltip}
                    />
                  );
                })}
                <div className="flex justify-end mt-6 gap-3">
                    <button onClick={handleClearForm('etp')} className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors">
                        <Icon name="eraser" className="mr-2" /> Limpar Formulário
                    </button>
                    <button onClick={() => handleSaveDocument('etp')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                        <Icon name="save" className="mr-2" /> Salvar ETP
                    </button>
                </div>
            </div>

            <div className={`${activeView === 'tr' ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                    <label htmlFor="etp-selector" className="block text-lg font-semibold text-slate-700 mb-3">1. Carregar ETP para Contexto</label>
                    <p className="text-sm text-slate-500 mb-4">Selecione um Estudo Técnico Preliminar (ETP) salvo para fornecer contexto à IA na geração do Termo de Referência (TR).</p>
                    <select
                        id="etp-selector"
                        onChange={(e) => handleLoadEtpForTr(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        defaultValue=""
                    >
                        <option value="">-- Selecione um ETP --</option>
                        {savedETPs.map(etp => (
                            <option key={etp.id} value={etp.id}>{etp.name}</option>
                        ))}
                    </select>
                    {loadedEtpForTr && (
                        <div className="mt-4 p-3 bg-green-50 text-green-800 border-l-4 border-green-500 rounded-r-lg">
                            <p className="font-semibold">ETP "{loadedEtpForTr.name}" carregado com sucesso.</p>
                        </div>
                    )}
                </div>

                {trSections.map(section => (
                    <Section
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        placeholder={section.placeholder}
                        value={trSectionsContent[section.id]}
                        onChange={(id, value) => handleSectionChange('tr', id, value)}
                        onGenerate={() => handleGenerate('tr', section.id, section.title)}
                        hasGen={section.hasGen}
                        isLoading={loadingSection === section.id}
                        onAnalyze={() => handleRiskAnalysis(section.id, section.title)}
                        hasRiskAnalysis={section.hasRiskAnalysis}
                        onEdit={() => handleOpenEditModal('tr', section.id, section.title)}
                        hasError={validationErrors.has(section.id)}
                        tooltip={section.tooltip}
                    />
                ))}
                <div className="flex justify-end mt-6 gap-3">
                    <button onClick={handleClearForm('tr')} className="bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors">
                        <Icon name="eraser" className="mr-2" /> Limpar Formulário
                    </button>
                    <button onClick={() => handleSaveDocument('tr')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                        <Icon name="save" className="mr-2" /> Salvar TR
                    </button>
                </div>
            </div>

             <footer className="text-center mt-8 pt-6 border-t border-slate-200 text-slate-500 text-sm">
                <p>Desenvolvido por um expert em React & IA.</p>
            </footer>
          </main>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Sobre o TR Genius" maxWidth="max-w-2xl">
          <div className="space-y-4 text-slate-600">
              <p>O <b>TR Genius</b> é o seu assistente inteligente para a elaboração de documentos de contratação pública, totalmente alinhado com a Nova Lei de Licitações e Contratos (Lei 14.133/21).</p>
                <ul className="list-none space-y-2">
                    <li className="flex items-start"><Icon name="wand-magic-sparkles" className="text-blue-500 mt-1 mr-3" /> <div><b>Geração de ETP e TR com IA:</b> Crie secções inteiras dos seus documentos com um clique, com base no contexto que fornecer.</div></li>
                    <li className="flex items-start"><Icon name="shield-alt" className="text-blue-500 mt-1 mr-3" /> <div><b>Análise de Riscos:</b> Identifique e mitigue potenciais problemas no seu projeto antes mesmo de ele começar.</div></li>
                    <li className="flex items-start"><Icon name="check-double" className="text-blue-500 mt-1 mr-3" /> <div><b>Verificador de Conformidade:</b> Garanta que os seus Termos de Referência estão em conformidade com a legislação vigente.</div></li>
                    <li className="flex items-start"><Icon name="file-alt" className="text-blue-500 mt-1 mr-3" /> <div><b>Contexto com Ficheiros:</b> Faça o upload de documentos para que a IA tenha um conhecimento ainda mais aprofundado sobre a sua necessidade específica.</div></li>
                </ul>
              <p>Esta ferramenta foi projetada para otimizar o seu tempo, aumentar a qualidade dos seus documentos e garantir a segurança jurídica das suas contratações.</p>
          </div>
      </Modal>

      <Modal isOpen={!!message} onClose={() => setMessage(null)} title={message?.title || ''}>
        <p className="whitespace-pre-wrap">{message?.text}</p>
        <div className="flex justify-end mt-4">
            <button onClick={() => setMessage(null)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">OK</button>
        </div>
      </Modal>

      <Modal 
        isOpen={isPreviewModalOpen} 
        onClose={() => setIsPreviewModalOpen(false)} 
        title="Pré-visualização do Documento" 
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-end">
            <button
              onClick={handleExportToPDF}
              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Icon name="file-pdf" className="mr-2" /> Exportar para PDF
            </button>
          </div>
        }
      >
          {renderPreviewContent()}
      </Modal>
      
      <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title={`Editar: ${editingContent?.title}`} maxWidth="max-w-3xl">
        {editingContent && (
          <div>
            <textarea
              value={editingContent.text}
              onChange={(e) => setEditingContent({ ...editingContent, text: e.target.value })}
              className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors mb-4"
              disabled={isRefining}
            />
            <div className="bg-slate-100 p-4 rounded-lg mb-4">
              <label htmlFor="refine-prompt" className="block text-sm font-semibold text-slate-600 mb-2">Peça à IA para refinar o texto acima:</label>
              <div className="flex gap-2">
                <input
                  id="refine-prompt"
                  type="text"
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  placeholder="Ex: 'Torne o tom mais formal' ou 'Adicione um parágrafo sobre sustentabilidade'"
                  className="flex-grow p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500"
                  disabled={isRefining}
                />
                <button
                  onClick={handleRefineText}
                  disabled={!refinePrompt || isRefining}
                  className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Icon name="wand-magic-sparkles" className="mr-2" /> {isRefining ? 'A refinar...' : 'Assim mas...'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeEditModal} className="bg-transparent border border-slate-400 text-slate-600 font-bold py-2 px-4 rounded-lg hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveChanges} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                <Icon name="save" className="mr-2" /> Salvar Alterações
              </button>
            </div>
          </div>
        )}
    </Modal>

      <Modal isOpen={!!analysisContent.content} onClose={() => setAnalysisContent({title: '', content: null})} title={analysisContent.title} maxWidth="max-w-3xl">
          <div className="bg-slate-50 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap word-wrap font-sans text-sm text-slate-700">{analysisContent.content}</pre>
          </div>
      </Modal>

      <Modal isOpen={!!viewingAttachment} onClose={() => setViewingAttachment(null)} title={viewingAttachment?.name || 'Visualizador de Anexo'} maxWidth="max-w-4xl">
        {viewingAttachment && (
            <div className="w-full h-[75vh]">
                {viewingAttachment.type.startsWith('image/') ? (
                    <img src={getAttachmentDataUrl(viewingAttachment)} alt={viewingAttachment.name} className="max-w-full max-h-full mx-auto object-contain" />
                ) : viewingAttachment.type === 'application/pdf' ? (
                    <object data={getAttachmentDataUrl(viewingAttachment)} type="application/pdf" width="100%" height="100%">
                        <p>O seu navegador não suporta a pré-visualização de PDFs. <a href={getAttachmentDataUrl(viewingAttachment)} download={viewingAttachment.name} className="text-blue-600 hover:underline">Clique aqui para fazer o download.</a></p>
                    </object>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-slate-100 rounded-lg p-8">
                        <Icon name="file-download" className="text-5xl text-slate-400 mb-4" />
                        <p className="text-slate-700 text-lg mb-2">A pré-visualização não está disponível para este tipo de ficheiro.</p>
                        <p className="text-slate-500 mb-6">({viewingAttachment.type})</p>
                        <a 
                            href={getAttachmentDataUrl(viewingAttachment)} 
                            download={viewingAttachment.name}
                            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Fazer Download
                        </a>
                    </div>
                )}
            </div>
        )}
    </Modal>

    </div>
  );
};

export default App;