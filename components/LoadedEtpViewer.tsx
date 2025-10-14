import React, { useState } from 'react';
import { SavedDocument } from '../types';
import { Icon } from './Icon';
import { etpSections } from '../config/sections';

export const LoadedEtpViewer: React.FC<{ etp: SavedDocument }> = ({ etp }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-xl shadow-sm mb-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex justify-between items-center text-left"
                aria-expanded={isExpanded}
                aria-controls={`etp-context-${etp.id}`}
            >
                <div>
                    <h3 className="text-lg font-semibold text-blue-800">Contexto do ETP Carregado</h3>
                    <p className="text-sm text-blue-700 font-medium truncate">{etp.name}</p>
                </div>
                <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} className="text-blue-600 text-xl transition-transform" />
            </button>
            <div
                id={`etp-context-${etp.id}`}
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px] mt-4 pt-4 border-t border-blue-200' : 'max-h-0'}`}
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {etpSections.map(section => {
                        const content = etp.sections[section.id];
                        if (content && String(content).trim()) {
                            return (
                                <div key={section.id}>
                                    <h4 className="font-semibold text-slate-700 text-base mb-1">{section.title}</h4>
                                    <div className="p-3 bg-white rounded-md border border-slate-200">
                                        <p className="whitespace-pre-wrap text-slate-800 text-sm leading-relaxed">{content}</p>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
};
