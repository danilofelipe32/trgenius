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

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ attachments, onAttachmentsChange, onPreview, setMessage }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    const existingNames = attachments.map(a => a.name);

    for (const file of Array.from(files)) {
      if (existingNames.includes(file.name)) {
        setMessage({ title: 'Aviso', text: `O ficheiro "${file.name}" já foi anexado.` });
        continue;
      }
      try {
        const base64Content = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          content: base64Content,
        });
      } catch (error) {
        console.error("Error converting file to base64", error);
        setMessage({ title: 'Erro', text: `Não foi possível processar o ficheiro "${file.name}".` });
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
  }, [attachments, onAttachmentsChange, setMessage]);

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
        <p className="text-xs text-slate-400 mt-1">PDF, DOCX, Imagens, etc.</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-600">Ficheiros Anexados:</h4>
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center bg-slate-100 p-3 rounded-lg text-sm transition-all shadow-sm hover:shadow-md">
              <Icon name={getFileIcon(file.type)} className="text-xl text-slate-500 mr-4" />
              <div className="flex-grow truncate">
                <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button onClick={() => onPreview(file)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs p-2 rounded-md hover:bg-blue-100 transition-colors" title="Visualizar">
                  <Icon name="eye" /> Visualizar
                </button>
                <button onClick={() => handleDownload(file)} className="flex items-center gap-1 text-green-600 hover:text-green-800 font-semibold text-xs p-2 rounded-md hover:bg-green-100 transition-colors" title="Baixar">
                  <Icon name="download" /> Baixar
                </button>
                <button onClick={() => handleRemove(index)} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold text-xs p-2 rounded-md hover:bg-red-100 transition-colors" title="Remover">
                  <Icon name="trash" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
