export type BgPalette = {
  score: number;
  bg: string;
  bgDark: string;
};

export type Theme = {
  id: string;
  name: string;
  // CSS variable overrides
  bg: string;
  bgDark: string;
  boardBg: string;
  cellEmpty: string;
  cellBorder: string;
  cardBg: string;
  cardBgLight: string;
  accent: string;
  accentDark: string;
  accentGlow: string;
  textPrimary: string;
  textSecondary: string;
  // Score-based background cycling
  bgPalettes: BgPalette[];
  // Swatch preview colors (gradient)
  swatchFrom: string;
  swatchTo: string;
};

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    bg: '#4A5899',
    bgDark: '#3D4A80',
    boardBg: '#1A1F3D',
    cellEmpty: '#232850',
    cellBorder: '#1A1F3D',
    cardBg: '#2A3060',
    cardBgLight: '#354080',
    accent: '#5B8DEF',
    accentDark: '#4A7BDD',
    accentGlow: 'rgba(91, 141, 239, 0.35)',
    textPrimary: '#ffffff',
    textSecondary: '#9BA3C7',
    bgPalettes: [
      { score: 0,    bg: '#4A5899', bgDark: '#3D4A80' },
      { score: 500,  bg: '#2D7D6F', bgDark: '#1E5C4F' },
      { score: 1500, bg: '#6B3FA0', bgDark: '#4A2D72' },
      { score: 3000, bg: '#B85C38', bgDark: '#8B4329' },
      { score: 5000, bg: '#A84171', bgDark: '#7B2F54' },
      { score: 8000, bg: '#2E4272', bgDark: '#1E2D4F' },
    ],
    swatchFrom: '#4A5899',
    swatchTo: '#5B8DEF',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#0D0D0D',
    bgDark: '#000000',
    boardBg: '#111111',
    cellEmpty: '#1A1A1A',
    cellBorder: '#111111',
    cardBg: '#1A1A1A',
    cardBgLight: '#242424',
    accent: '#E0E0E0',
    accentDark: '#BDBDBD',
    accentGlow: 'rgba(224, 224, 224, 0.2)',
    textPrimary: '#F5F5F5',
    textSecondary: '#757575',
    bgPalettes: [
      { score: 0,    bg: '#0D0D0D', bgDark: '#000000' },
      { score: 500,  bg: '#0F1518', bgDark: '#060A0D' },
      { score: 1500, bg: '#150D1A', bgDark: '#0A0610' },
      { score: 3000, bg: '#1A1208', bgDark: '#0F0A04' },
      { score: 5000, bg: '#1A0D12', bgDark: '#0F0609' },
      { score: 8000, bg: '#0D0D18', bgDark: '#06060F' },
    ],
    swatchFrom: '#1A1A1A',
    swatchTo: '#333333',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '#1A4B5E',
    bgDark: '#0F2F3D',
    boardBg: '#0D2028',
    cellEmpty: '#153040',
    cellBorder: '#0D2028',
    cardBg: '#1A3A4A',
    cardBgLight: '#244A5C',
    accent: '#4DD0E1',
    accentDark: '#26C6DA',
    accentGlow: 'rgba(77, 208, 225, 0.3)',
    textPrimary: '#E0F7FA',
    textSecondary: '#80CBC4',
    bgPalettes: [
      { score: 0,    bg: '#1A4B5E', bgDark: '#0F2F3D' },
      { score: 500,  bg: '#1B5E5E', bgDark: '#0F3D3D' },
      { score: 1500, bg: '#1A3D6E', bgDark: '#0F284A' },
      { score: 3000, bg: '#2D5E60', bgDark: '#1A3D40' },
      { score: 5000, bg: '#1A4A6E', bgDark: '#0F304A' },
      { score: 8000, bg: '#0F3050', bgDark: '#081E32' },
    ],
    swatchFrom: '#1A4B5E',
    swatchTo: '#4DD0E1',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    bg: '#8B3A2E',
    bgDark: '#6B2A20',
    boardBg: '#2A1510',
    cellEmpty: '#3D2018',
    cellBorder: '#2A1510',
    cardBg: '#4A2A20',
    cardBgLight: '#5C3A2E',
    accent: '#FFB74D',
    accentDark: '#FFA726',
    accentGlow: 'rgba(255, 183, 77, 0.35)',
    textPrimary: '#FFF3E0',
    textSecondary: '#FFAB91',
    bgPalettes: [
      { score: 0,    bg: '#8B3A2E', bgDark: '#6B2A20' },
      { score: 500,  bg: '#9B5A30', bgDark: '#7B4220' },
      { score: 1500, bg: '#8B4A50', bgDark: '#6B3038' },
      { score: 3000, bg: '#A06030', bgDark: '#804820' },
      { score: 5000, bg: '#8B3050', bgDark: '#6B2038' },
      { score: 8000, bg: '#6B3A50', bgDark: '#4B2838' },
    ],
    swatchFrom: '#8B3A2E',
    swatchTo: '#FFB74D',
  },
  {
    id: 'neon',
    name: 'Neon',
    bg: '#1A0A2E',
    bgDark: '#0D0518',
    boardBg: '#0F0820',
    cellEmpty: '#1A1035',
    cellBorder: '#0F0820',
    cardBg: '#201545',
    cardBgLight: '#2A1D58',
    accent: '#E040FB',
    accentDark: '#D500F9',
    accentGlow: 'rgba(224, 64, 251, 0.4)',
    textPrimary: '#F3E5F5',
    textSecondary: '#CE93D8',
    bgPalettes: [
      { score: 0,    bg: '#1A0A2E', bgDark: '#0D0518' },
      { score: 500,  bg: '#0A1A30', bgDark: '#050D18' },
      { score: 1500, bg: '#2A0A28', bgDark: '#180518' },
      { score: 3000, bg: '#0A2A2A', bgDark: '#051818' },
      { score: 5000, bg: '#2A1A0A', bgDark: '#180D05' },
      { score: 8000, bg: '#0A0A30', bgDark: '#050520' },
    ],
    swatchFrom: '#1A0A2E',
    swatchTo: '#E040FB',
  },
];

export function getThemeById(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

/** Apply a theme's CSS variables to the document root. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--bg-dark', theme.bgDark);
  root.style.setProperty('--board-bg', theme.boardBg);
  root.style.setProperty('--cell-empty', theme.cellEmpty);
  root.style.setProperty('--cell-border', theme.cellBorder);
  root.style.setProperty('--card-bg', theme.cardBg);
  root.style.setProperty('--card-bg-light', theme.cardBgLight);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dark', theme.accentDark);
  root.style.setProperty('--accent-glow', theme.accentGlow);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
}
