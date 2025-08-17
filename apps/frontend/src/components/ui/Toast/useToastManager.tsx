import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { setToastManager } from '@/components/ui/Toast/toast';

export const useToastManager = () => {
  const toastContext = useToast();

  useEffect(() => {
    setToastManager({
      addToast: toastContext.addToast,
      removeToast: toastContext.removeToast,
      updateToast: toastContext.updateToast,
      clearToasts: toastContext.clearToasts,
    });

    return () => {
      setToastManager(null);
    };
  }, [toastContext]);

  return toastContext;
};
