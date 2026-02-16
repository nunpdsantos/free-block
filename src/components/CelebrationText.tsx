import { useEffect } from 'react';
import './CelebrationText.css';

type CelebrationTextProps = {
  text: string | null;
  onDismiss: () => void;
};

/** Derive visual intensity level from celebration text */
function getLevel(text: string): number {
  if (text === 'ALL CLEAR!') return 5;
  if (text === 'Perfect!') return 4;
  if (text === 'Amazing!') return 3;
  if (text === 'Excellent!') return 2;
  return 1;
}

export function CelebrationText({ text, onDismiss }: CelebrationTextProps) {
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [text, onDismiss]);

  if (!text) return null;

  const level = getLevel(text);
  const isAllClear = level === 5;
  const isRainbow = level >= 3;

  let className = 'celebration-text';
  className += ` celebration-text--level-${Math.min(level, 4)}`;
  if (isRainbow) className += ' celebration-text--rainbow';
  if (isAllClear) className += ' celebration-text--allclear';

  return (
    <div className="celebration">
      <span className={className}>{text}</span>
    </div>
  );
}
