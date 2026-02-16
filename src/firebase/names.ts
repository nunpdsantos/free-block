const ADJECTIVES = [
  'Swift', 'Bold', 'Fierce', 'Clever', 'Bright',
  'Calm', 'Daring', 'Quick', 'Sharp', 'Brave',
  'Wild', 'Sly', 'Keen', 'Noble', 'Grand',
  'Vivid', 'Lucky', 'Witty', 'Zesty', 'Nimble',
  'Chill', 'Epic', 'Rad', 'Slick', 'Turbo',
  'Mega', 'Ultra', 'Hyper', 'Rapid', 'Mighty',
];

const NOUNS = [
  'Falcon', 'Tiger', 'Fox', 'Hawk', 'Wolf',
  'Raven', 'Lynx', 'Bear', 'Eagle', 'Cobra',
  'Phoenix', 'Panther', 'Viper', 'Shark', 'Dragon',
  'Storm', 'Blaze', 'Frost', 'Ember', 'Spark',
  'Pixel', 'Comet', 'Nova', 'Zenith', 'Cipher',
  'Glitch', 'Orbit', 'Prism', 'Surge', 'Vertex',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDisplayName(): string {
  return `${pick(ADJECTIVES)}_${pick(NOUNS)}`;
}
