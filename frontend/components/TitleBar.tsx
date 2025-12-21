import React from 'react';
import { Minus, X } from 'lucide-react';

const TitleBar: React.FC = () => {
    const handleMinimize = () => {
        if (window.electronAPI) {
            window.electronAPI.minimizeWindow();
        }
    };

    const handleClose = () => {
        if (window.electronAPI) {
            window.electronAPI.closeWindow();
        }
    };

    return (
        <div
            className="h-8 bg-surface border-b border-border flex items-center justify-between px-4 select-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center">
                    <div className="w-2 h-2 bg-primary rounded-sm"></div>
                </div>
                <span className="text-xs text-secondary font-medium">Onyx Backup</span>
            </div>

            <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    onClick={handleMinimize}
                    className="w-8 h-8 flex items-center justify-center hover:bg-neutral-800 transition-colors text-secondary hover:text-primary"
                    title="Minimize"
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={handleClose}
                    className="w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors text-secondary hover:text-white"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
