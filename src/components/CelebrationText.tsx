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

  const isAllClear = text === 'ALL CLEAR!';
  const isRainbow = text !== 'Good Work!';

  let className = 'celebration-text';
  if (isRainbow) className += ' celebration-text--rainbow';
  if (isAllClear) className += ' celebration-text--allclear';

  return (
    <div className="celebration" key={text + Date.now()}>
      <span className={className}>{text}</span>
    </div>
  );
}
