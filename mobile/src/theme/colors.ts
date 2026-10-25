/**
 * Apple Design System — Color Tokens (SRS / DESIGN.md)
 */
export const colors = {
  primary: '#0066CC',
  primaryFocus: '#0071E3',
  primaryDark: '#2997FF',
  ink: '#1D1D1F',
  white: '#FFFFFF',
  parchment: '#F5F5F7',
  pearl: '#FAFAFC',
  dark1: '#272729',
  dark2: '#2A2A2C',
  dark3: '#252527',
  textMuted: '#7A7A7A',
  textOnDark: '#FFFFFF',
  textMutedDark: '#CCCCCC',
  border: '#E0E0E0',
  divider: '#F0F0F0',
  black: '#000000',
  destructive: '#DC2626',
} as const;

export type ColorToken = keyof typeof colors;
