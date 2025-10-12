import React, { useState, useMemo } from 'react';
import { SavedDocument, DocumentVersion, Section } from '../types';
import { Icon } from './Icon';

// Simple Word-level Diff Algorithm (Longest Common Subsequence based)
const diffWords = (text1: string, text2: string): { html1: string, html2: string } => {
    const words1 = text1.split(/(\s+)/);
    const words2 = text2.split(/(\s+)/);
    
    const n = words1.length;
    const m = words2.length;
    const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (words1[i - 1] === words2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    let i = n, j = m;
    const result1: string[] = [];
    const result2: string[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
            result1.unshift(words1[i - 1]);
            result2.unshift(words2[j - 1]);
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result2.unshift(`<ins>${words2[j - 1]}</ins>`);
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            result1.unshift(`<del>${words1[i - 1]}</del>`);
            i--;
        } else {
            break; // Should not happen
        }
    }

    return {
        html1: result1.join(''),
        html2: result2.join('')
    };
};

interface HistoryViewerProps {
    document: SavedDocument;
    allSections: Section[];
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ document, allSections }) => {
    const [compareIndexA, setCompareIndexA] = useState<number>(0); // 0 is the latest version from history
    const [compareIndexB, setCompareIndexB] = useState<number>(1); // 1 is the second latest
    
    const versions = document.history || [];

    const versionA = versions[compareIndexA];
    const versionB = versions[compareIndexB];

    const allSectionIds = useMemo(() => {
        const sectionIds = new Set<string>();
        allSections.forEach(s => sectionIds.add(s.id));
        return Array.from(sectionIds);
    }, [allSections]);
    
    const diffs = useMemo(() => {
        if (!versionA || !versionB) return {};

        return allSectionIds.reduce((acc, sectionId) => {
            const textA = versionA.sections[sectionId] || '';
            const textB = versionB.sections[sectionId] || '';
            if (textA === textB) {
                acc[sectionId] = { same: true, content: textA };
            } else {
                acc[sectionId] = { same: false, ...diffWords(textB, textA) };
            }
            return acc;
        }, {} as Record<string, any>);

    }, [versionA, versionB, allSectionIds]);

    if (!versions || versions.length < 2) {
        return (
            <div className="text-center p-8 text-slate-500">
                <Icon name="info-circle" className="text-2xl mb-2" />
                <p>Não há histórico de versões suficiente para comparação.</p>
                <p className="text-sm">Salve alterações no documento para começar a criar um histórico.</p>
            </div>
        );
    }
    
    const renderSelector = (selectedValue: number, setValue: (value: number) => void, label: string) => (
        <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
            <select
                value={selectedValue}
                onChange={(e) => setValue(parseInt(e.target.value, 10))}
                className="w-full p-2 border border-slate-300 rounded-md bg-white"
            >
                {versions.map((v, index) => (
                    <option key={index} value={index}>
                        {index === 0 ? 'Versão Mais Recente' : `Versão de ${new Date(v.timestamp).toLocaleString('pt-BR')}`}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <style>{`
                ins { background-color: #dcfce7; color: #166534; text-decoration: none; }
                del { background-color: #fee2e2; color: #991b1b; text-decoration: line-through; }
            `}</style>
            
            <aside className="w-full md:w-1/4 p-4 bg-slate-50 rounded-lg border">
                <h3 className="text-lg font-bold mb-4">Comparar Versões</h3>
                <div className="space-y-4">
                   {renderSelector(compareIndexA, setCompareIndexA, 'Exibir Versão (Direita):')}
                   {renderSelector(compareIndexB, setCompareIndexB, 'Com a Versão (Esquerda):')}
                </div>
                 {versionA && versionB && (
                    <div className="mt-6 text-sm space-y-3 pt-4 border-t">
                        <div>
                            <p className="font-semibold text-slate-800">Versão (Esquerda):</p>
                            <p className="text-slate-600">{versionB.summary}</p>
                            <p className="text-xs text-slate-500">{new Date(versionB.timestamp).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">Versão (Direita):</p>
                            <p className="text-slate-600">{versionA.summary}</p>
                            <p className="text-xs text-slate-500">{new Date(versionA.timestamp).toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                 )}
            </aside>

            <main className="w-full md:w-3/4 max-h-[70vh] overflow-y-auto pr-2">
                {allSectionIds.map(sectionId => {
                    const diff = diffs[sectionId];
                    const sectionInfo = allSections.find(s => s.id === sectionId);
                    if (!diff || !sectionInfo) return null;

                    return (
                        <div key={sectionId} className="mb-6">
                            <h4 className="text-xl font-bold text-slate-800 mb-3 p-2 bg-slate-100 rounded-md sticky top-0">{sectionInfo.title}</h4>
                            {diff.same ? (
                                <div className="p-4 bg-white border rounded-lg text-slate-500 italic">
                                    Sem alterações nesta seção.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white border rounded-lg p-4">
                                        <div 
                                            className="whitespace-pre-wrap text-sm leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: diff.html1 || '<i class="text-slate-400">Vazio</i>' }} 
                                        />
                                    </div>
                                    <div className="bg-white border rounded-lg p-4">
                                        <div 
                                            className="whitespace-pre-wrap text-sm leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: diff.html2 || '<i class="text-slate-400">Vazio</i>' }} 
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>
        </div>
    );
};
