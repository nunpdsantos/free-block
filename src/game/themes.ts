export type BgPalette = {
  score: number;
  bg: string;
  bgDark: string;
  bgTense: string;
  bgDarkTense: string;
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
      { score: 0,    bg: '#4A5899', bgDark: '#3D4A80', bgTense: '#3A4468', bgDarkTense: '#2E3658' },
      { score: 500,  bg: '#2D7D6F', bgDark: '#1E5C4F', bgTense: '#2A5E56', bgDarkTense: '#1C4438' },
      { score: 1500, bg: '#6B3FA0', bgDark: '#4A2D72', bgTense: '#503470', bgDarkTense: '#382452' },
      { score: 3000, bg: '#B85C38', bgDark: '#8B4329', bgTense: '#8A4A30', bgDarkTense: '#683520' },
      { score: 5000, bg: '#A84171', bgDark: '#7B2F54', bgTense: '#7E3558', bgDarkTense: '#5C2540' },
      { score: 8000, bg: '#2E4272', bgDark: '#1E2D4F', bgTense: '#263454', bgDarkTense: '#1A243A' },
    ],
    swatchFrom: '#4A5899',
    swatchTo: '#5B8DEF',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#1A1A2E',
    bgDark: '#0F0F1A',
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
      { score: 0,    bg: '#1A1A2E', bgDark: '#0F0F1A', bgTense: '#151520', bgDarkTense: '#0A0A12' },
      { score: 500,  bg: '#1A2E2A', bgDark: '#0F1A18', bgTense: '#15201E', bgDarkTense: '#0A1210' },
      { score: 1500, bg: '#2E1A2E', bgDark: '#1A0F1A', bgTense: '#201520', bgDarkTense: '#120A12' },
      { score: 3000, bg: '#2E2A1A', bgDark: '#1A180F', bgTense: '#201E15', bgDarkTense: '#12100A' },
      { score: 5000, bg: '#2E1A22', bgDark: '#1A0F14', bgTense: '#201518', bgDarkTense: '#120A0E' },
      { score: 8000, bg: '#1A1A30', bgDark: '#0F0F1C', bgTense: '#151522', bgDarkTense: '#0A0A14' },
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
      { score: 0,    bg: '#1A4B5E', bgDark: '#0F2F3D', bgTense: '#163A48', bgDarkTense: '#0C242E' },
      { score: 500,  bg: '#1B5E5E', bgDark: '#0F3D3D', bgTense: '#164848', bgDarkTense: '#0C2E2E' },
      { score: 1500, bg: '#1A3D6E', bgDark: '#0F284A', bgTense: '#163054', bgDarkTense: '#0C2038' },
      { score: 3000, bg: '#2D5E60', bgDark: '#1A3D40', bgTense: '#24484A', bgDarkTense: '#162E30' },
      { score: 5000, bg: '#1A4A6E', bgDark: '#0F304A', bgTense: '#163A54', bgDarkTense: '#0C2638' },
      { score: 8000, bg: '#0F3050', bgDark: '#081E32', bgTense: '#0C263E', bgDarkTense: '#081826' },
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
      { score: 0,    bg: '#8B3A2E', bgDark: '#6B2A20', bgTense: '#6A2E24', bgDarkTense: '#502018' },
      { score: 500,  bg: '#9B5A30', bgDark: '#7B4220', bgTense: '#764628', bgDarkTense: '#5C3418' },
      { score: 1500, bg: '#8B4A50', bgDark: '#6B3038', bgTense: '#6A3A3E', bgDarkTense: '#50262A' },
      { score: 3000, bg: '#A06030', bgDark: '#804820', bgTense: '#7A4A28', bgDarkTense: '#603818' },
      { score: 5000, bg: '#8B3050', bgDark: '#6B2038', bgTense: '#6A283E', bgDarkTense: '#501A2A' },
      { score: 8000, bg: '#6B3A50', bgDark: '#4B2838', bgTense: '#522E3E', bgDarkTense: '#3A202A' },
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
      { score: 0,    bg: '#1A0A2E', bgDark: '#0D0518', bgTense: '#140A20', bgDarkTense: '#0A0510' },
      { score: 500,  bg: '#0A1A30', bgDark: '#050D18', bgTense: '#0A1422', bgDarkTense: '#050A10' },
      { score: 1500, bg: '#2A0A28', bgDark: '#180518', bgTense: '#1E0A1E', bgDarkTense: '#120510' },
      { score: 3000, bg: '#0A2A2A', bgDark: '#051818', bgTense: '#0A1E1E', bgDarkTense: '#051210' },
      { score: 5000, bg: '#2A1A0A', bgDark: '#180D05', bgTense: '#1E140A', bgDarkTense: '#120A05' },
      { score: 8000, bg: '#0A0A30', bgDark: '#050520', bgTense: '#0A0A22', bgDarkTense: '#050516' },
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
