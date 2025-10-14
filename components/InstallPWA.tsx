import React from 'react';
import { Icon } from './Icon';

interface InstallPWAProps {
  onInstall: () => void;
  onDismiss: () => void;
}

const pwaIcon = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3crect width='100' height='100' rx='20' fill='%233b82f6'/%3e%3ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='sans-serif' font-size='50' fill='white' font-weight='bold'%3eTRG%3c/text%3e%3c/svg%3e";

const InstallPWA: React.FC<InstallPWAProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 animate-slide-up" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={pwaIcon} alt="TR Genius Logo" className="w-12 h-12" />
          <div>
            <h4 className="font-bold text-slate-800">Instale o TR Genius</h4>
            <p className="text-sm text-slate-600">Adicione à tela inicial para acesso rápido e offline.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            Agora não
          </button>
          <button
            onClick={onInstall}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default InstallPWA;