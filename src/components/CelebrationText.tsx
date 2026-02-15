import { useEffect } from 'react';
import './CelebrationText.css';

type CelebrationTextProps = {
  text: string | null;
  onDismiss: () => void;
};

export function CelebrationText({ text, onDismiss }: CelebrationTextProps) {
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [text, onDismiss]);

  if (!text) return null;

  return (
    <div className="celebration" key={text + Date.now()}>
      <span className="celebration-text">{text}</span>
    </div>
  );
}
