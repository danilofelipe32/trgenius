import React, { useState, useRef, useCallback } from 'react';
import { Attachment } from '../types';
import { Icon } from './Icon';

interface AttachmentManagerProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  onPreview: (attachment: Attachment) => void;
  setMessage: (message: { title: string; text: string } | null) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'file-image';
  if (mimeType === 'application/pdf') return 'file-pdf';
  if (mimeType.includes('word')) return 'file-word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'file-powerpoint';
  return 'file-alt';
};

const TOTAL_SIZE_LIMIT_MB = 50;
const TOTAL_SIZE_LIMIT_BYTES = TOTAL_SIZE_LIMIT_MB * 1024 * 1024;

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ attachments, onAttachmentsChange, onPreview, setMessage }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<Array<{ name: string; status: 'processing' | 'success' | 'error'; message?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    setProcessingStatus(fileList.map(f => ({ name: f.name, status: 'processing' })));

    const newAttachments: Attachment[] = [];
    const existingNames = attachments.map(a => a.name);
    let currentTotalSize = attachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of fileList) {
      if (existingNames.includes(file.name)) {
        setProcessingStatus(prev => prev.map(p => p.name === file.name ? { ...p, status: 'error', message: 'Ficheiro duplicado.' } : p));
        continue;
      }
      
      if (currentTotalSize + file.size > TOTAL_SIZE_LIMIT_BYTES) {
        const errorMessage = `Limite de ${TOTAL_SIZE_LIMIT_MB}MB excedido.`;
        setProcessingStatus(prev => prev.map(p => p.name === file.name ? { ...p, status: 'error', message: errorMessage } : p));
        setMessage({ title: 'Erro de Anexo', text: `Não foi possível adicionar "${file.name}". O tamanho total dos anexos excederia o limite de ${TOTAL_SIZE_LIMIT_MB}MB.` });
        // Stop processing further files in this batch
        break; 
      }

      try {
        const base64Content = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          content: base64Content,
          description: '',
        });
        currentTotalSize += file.size; // Update total size after successful processing
        setProcessingStatus(prev => prev.map(p => p.name === file.name ? { ...p, status: 'success' } : p));
      } catch (error) {
        console.error("Error converting file to base64", error);
        const errorMessage = 'Falha na conversão.';
        setProcessingStatus(prev => prev.map(p => p.name === file.name ? { ...p, status: 'error', message: errorMessage } : p));
        setMessage({ title: 'Erro', text: `Não foi possível processar o ficheiro "${file.name}".` });
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
    
    setTimeout(() => {
        setProcessingStatus([]);
    }, 5000); // Clear status after 5 seconds

  }, [attachments, onAttachmentsChange, setMessage]);

  const handleDescriptionChange = (indexToUpdate: number, newDescription: string) => {
    const updatedAttachments = attachments.map((att, index) => 
      index === indexToUpdate ? { ...att, description: newDescription } : att
    );
    onAttachmentsChange(updatedAttachments);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (e.target) {
      e.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };

  const handleRemove = (indexToRemove: number) => {
    onAttachmentsChange(attachments.filter((_, index) => index !== indexToRemove));
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = `data:${attachment.type};base64,${attachment.content}`;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`flex flex-col items-center justify-center p-6 mb-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
      >
        <Icon name="cloud-upload-alt" className="text-4xl text-slate-400 mb-3" />
        <p className="text-slate-600 text-center">
          <span className="font-semibold text-blue-600">Clique para carregar</span> ou arraste e solte
        </p>
        <p className="text-xs text-slate-400 mt-1">Limite total: {TOTAL_SIZE_LIMIT_MB}MB</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
        />
      </div>

      {processingStatus.length > 0 && (
        <div className="mb-4 p-3 bg-slate-100 rounded-lg space-y-2">
            <h4 className="text-xs font-bold text-slate-600">
                A processar {processingStatus.filter(f => f.status !== 'processing').length} de {processingStatus.length} ficheiro(s)...
            </h4>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${(processingStatus.filter(f => f.status !== 'processing').length / processingStatus.length) * 100}%` }}
                ></div>
            </div>
            {processingStatus.map(file => (
                <div key={file.name} className="flex items-center text-xs justify-between">
                    <div className="flex items-center gap-2 truncate flex-1">
                        {file.status === 'processing' && <Icon name="spinner" className="fa-spin text-slate-400 flex-shrink-0" />}
                        {file.status === 'success' && <Icon name="check-circle" className="text-green-500 flex-shrink-0" />}
                        {file.status === 'error' && <Icon name="exclamation-circle" className="text-red-500 flex-shrink-0" />}
                        <span className="truncate">{file.name}</span>
                    </div>
                    {file.status === 'error' && <span className="ml-2 text-red-600 font-semibold flex-shrink-0">{file.message}</span>}
                </div>
            ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-slate-600">Ficheiros Anexados:</h4>
            <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                Total: {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))} / {TOTAL_SIZE_LIMIT_MB}MB
            </span>
          </div>
          {attachments.map((file, index) => (
            <div key={index} className="flex flex-col bg-slate-50 p-3 rounded-lg transition-all shadow-sm hover:shadow-md gap-2 border border-slate-200">
              <div className="flex items-center">
                <Icon name={getFileIcon(file.type)} className="text-xl text-slate-500 mr-4" />
                <div className="flex-grow truncate">
                  <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                  <button onClick={() => onPreview(file)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs p-2 rounded-md hover:bg-blue-100 transition-colors" title="Visualizar">
                    <Icon name="eye" /> <span className="hidden sm:inline">Visualizar</span>
                  </button>
                  <button onClick={() => handleDownload(file)} className="flex items-center gap-1 text-green-600 hover:text-green-800 font-semibold text-xs p-2 rounded-md hover:bg-green-100 transition-colors" title="Baixar">
                    <Icon name="download" /> <span className="hidden sm:inline">Baixar</span>
                  </button>
                  <button onClick={() => handleRemove(index)} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold text-xs p-2 rounded-md hover:bg-red-100 transition-colors" title="Remover">
                    <Icon name="trash" /> <span className="hidden sm:inline">Remover</span>
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                  <Icon name="comment-alt" className="text-slate-400 mt-1.5" />
                  <textarea
                      value={file.description || ''}
                      onChange={(e) => handleDescriptionChange(index, e.target.value)}
                      placeholder="Adicionar uma descrição..."
                      className="w-full text-sm bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y min-h-[40px] transition-all"
                      rows={1}
                  />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};