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
  // Achievement required to unlock (null = free)
  requiredAchievement?: string;
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
      { score: 500,  bg: '#1AAF8B', bgDark: '#148068', bgTense: '#1A7A60', bgDarkTense: '#105A46' },
      { score: 1500, bg: '#8338BF', bgDark: '#5C2890', bgTense: '#602880', bgDarkTense: '#421C5E' },
      { score: 3000, bg: '#D46830', bgDark: '#A84E22', bgTense: '#A05028', bgDarkTense: '#7A3C1A' },
      { score: 5000, bg: '#C43878', bgDark: '#962A5C', bgTense: '#943060', bgDarkTense: '#6E2044' },
      { score: 8000, bg: '#2E4A8A', bgDark: '#1E3260', bgTense: '#263A66', bgDarkTense: '#1A2848' },
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
      { score: 500,  bg: '#14332A', bgDark: '#0A1E18', bgTense: '#10241E', bgDarkTense: '#081610' },
      { score: 1500, bg: '#361A38', bgDark: '#200F20', bgTense: '#261528', bgDarkTense: '#160A16' },
      { score: 3000, bg: '#382E14', bgDark: '#201A0A', bgTense: '#282010', bgDarkTense: '#181408' },
      { score: 5000, bg: '#381428', bgDark: '#200A16', bgTense: '#28101E', bgDarkTense: '#180810' },
      { score: 8000, bg: '#141438', bgDark: '#0A0A22', bgTense: '#101028', bgDarkTense: '#080818' },
    ],
    swatchFrom: '#1A1A1A',
    swatchTo: '#333333',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    requiredAchievement: 'clean_slate',
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
      { score: 500,  bg: '#147068', bgDark: '#0A4A45', bgTense: '#105550', bgDarkTense: '#083836' },
      { score: 1500, bg: '#1A3580', bgDark: '#0F2258', bgTense: '#162A62', bgDarkTense: '#0C1C44' },
      { score: 3000, bg: '#1A7070', bgDark: '#0F4A4A', bgTense: '#145656', bgDarkTense: '#0A3838' },
      { score: 5000, bg: '#1A4888', bgDark: '#0F3060', bgTense: '#163868', bgDarkTense: '#0C2648' },
      { score: 8000, bg: '#0A3868', bgDark: '#062448', bgTense: '#082C50', bgDarkTense: '#061C36' },
    ],
    swatchFrom: '#1A4B5E',
    swatchTo: '#4DD0E1',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    requiredAchievement: 'inferno',
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
      { score: 500,  bg: '#B86820', bgDark: '#8C4E18', bgTense: '#8A5020', bgDarkTense: '#6A3C12' },
      { score: 1500, bg: '#9E3860', bgDark: '#782848', bgTense: '#782C4A', bgDarkTense: '#5A2036' },
      { score: 3000, bg: '#C47020', bgDark: '#985418', bgTense: '#945620', bgDarkTense: '#724010' },
      { score: 5000, bg: '#A02868', bgDark: '#7A1C4E', bgTense: '#7A2250', bgDarkTense: '#5C1638' },
      { score: 8000, bg: '#7A3868', bgDark: '#5A2848', bgTense: '#5E2C50', bgDarkTense: '#442036' },
    ],
    swatchFrom: '#8B3A2E',
    swatchTo: '#FFB74D',
  },
  {
    id: 'neon',
    name: 'Neon',
    requiredAchievement: 'no_safety_net',
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
      { score: 500,  bg: '#0A2240', bgDark: '#051420', bgTense: '#0A1830', bgDarkTense: '#050E18' },
      { score: 1500, bg: '#380A38', bgDark: '#200520', bgTense: '#280A28', bgDarkTense: '#180518' },
      { score: 3000, bg: '#0A3838', bgDark: '#052020', bgTense: '#0A2828', bgDarkTense: '#051818' },
      { score: 5000, bg: '#382408', bgDark: '#201405', bgTense: '#281A08', bgDarkTense: '#181005' },
      { score: 8000, bg: '#0A0A40', bgDark: '#050528', bgTense: '#0A0A30', bgDarkTense: '#05051C' },
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
