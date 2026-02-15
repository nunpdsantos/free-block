import { memo } from 'react';
import './Cell.css';

type CellProps = {
  color: string | null;
  isGhost: boolean;
  ghostValid: boolean;
  isClearing: boolean;
};

export const Cell = memo(function Cell({
  color,
  isGhost,
  ghostValid,
  isClearing,
}: CellProps) {
  let className = 'cell';
  if (color) className += ' cell--filled';
  if (isGhost) className += ghostValid ? ' cell--ghost-valid' : ' cell--ghost-invalid';
  if (isClearing) className += ' cell--clearing';

  return (
    <div
      className={className}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
});
