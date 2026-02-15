import { memo } from 'react';
import './Cell.css';

type CellProps = {
  color: string | null;
  isGhost: boolean;
  ghostValid: boolean;
  isClearing: boolean;
  clearDelay: number;
};

export const Cell = memo(function Cell({
  color,
  isGhost,
  ghostValid,
  isClearing,
  clearDelay,
}: CellProps) {
  let className = 'cell';
  if (color) className += ' cell--filled';
  if (isGhost) className += ghostValid ? ' cell--ghost-valid' : ' cell--ghost-invalid';
  if (isClearing) className += ' cell--clearing';

  const style: React.CSSProperties = {};
  if (color) style.backgroundColor = color;
  if (isClearing && clearDelay > 0) {
    style.animationDelay = `${clearDelay}ms`;
  }

  return (
    <div
      className={className}
      style={Object.keys(style).length > 0 ? style : undefined}
    />
  );
});
