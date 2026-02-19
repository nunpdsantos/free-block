import { useState, useEffect, useCallback } from 'react';

type InstallState = 'hidden' | 'prompt' | 'ios' | 'installed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>(() => {
    if (typeof window === 'undefined') return 'hidden';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'installed';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    return isIOS ? 'ios' : 'hidden';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (state !== 'hidden') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState('prompt');
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setState('installed');
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, [state]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setState('installed');
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { state, install };
}
