import { memo } from 'react';
import './Cell.css';

type CellProps = {
  color: string | null;
  isGhost: boolean;
  ghostValid: boolean;
  ghostColor?: string;
  ghostCompletesLine?: boolean;
  isClearing: boolean;
  clearDelay: number;
  isPreClearing?: boolean;
  isShattered?: boolean;
  shatterStyle?: React.CSSProperties;
  isSettling?: boolean;
};

export const Cell = memo(function Cell({
  color,
  isGhost,
  ghostValid,
  ghostColor,
  ghostCompletesLine,
  isClearing,
  clearDelay,
  isPreClearing,
  isShattered,
  shatterStyle,
  isSettling,
}: CellProps) {
  let className = 'cell';
  if (color) className += ' cell--filled';
  if (isGhost) className += ghostValid ? ' cell--ghost-valid' : ' cell--ghost-invalid';
  if (ghostCompletesLine) className += ' cell--ghost-completing';
  if (isPreClearing) className += ' cell--pre-clear';
  if (isClearing) className += ' cell--clearing';
  if (isShattered && color) className += ' cell--shattered';
  if (isSettling && color) className += ' cell--settling';

  const style: React.CSSProperties = {};
  if (color) style.backgroundColor = color;
  if (isClearing && clearDelay > 0) {
    style.animationDelay = `${clearDelay}ms`;
  }

  // Ghost color — convert hex to rgba at low opacity
  if (isGhost && ghostValid && ghostColor) {
    const r = parseInt(ghostColor.slice(1, 3), 16);
    const g = parseInt(ghostColor.slice(3, 5), 16);
    const b = parseInt(ghostColor.slice(5, 7), 16);
    (style as Record<string, string>)['--ghost-color'] = `rgba(${r}, ${g}, ${b}, 0.5)`;
  }

  // Shatter CSS vars
  if (isShattered && shatterStyle) {
    Object.assign(style, shatterStyle);
  }

  return (
    <div
      className={className}
      style={Object.keys(style).length > 0 ? style : undefined}
    />
  );
});
