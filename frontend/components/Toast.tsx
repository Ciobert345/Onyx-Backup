import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface ToastProps {
    message: string;
    onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger entry animation after mount
        const entryTimer = setTimeout(() => setIsVisible(true), 50);

        // Auto collapse after 5 seconds
        const dismissTimer = setTimeout(() => {
            handleClose();
        }, 5000);

        return () => {
            clearTimeout(entryTimer);
            clearTimeout(dismissTimer);
        };
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation to finish before unmounting (calling parent dismiss)
        setTimeout(onDismiss, 500);
    };

    return (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none">
            <div
                className={`bg-white border border-neutral-200 text-neutral-900 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg pointer-events-auto transition-all duration-500 ease-in-out transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
                    }`}
            >
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold">{message}</span>
                <button
                    onClick={handleClose}
                    className="ml-1 text-neutral-400 hover:text-neutral-900 transition-colors"
                    title="Dismiss"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default Toast;
