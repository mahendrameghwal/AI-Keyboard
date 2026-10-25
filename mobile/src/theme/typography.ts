import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
});

export const typography = {
  hero: {
    fontFamily,
    fontSize: 56,
    fontWeight: '600',
    lineHeight: 60, // ~1.07
    letterSpacing: -1.2,
  } as TextStyle,

  displayLarge: {
    fontFamily,
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 44, // ~1.10
    letterSpacing: -0.8,
  } as TextStyle,

  displayMedium: {
    fontFamily,
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 41, // ~1.20
    letterSpacing: -0.5,
  } as TextStyle,

  lead: {
    fontFamily,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32, // ~1.14
    letterSpacing: -0.2,
  } as TextStyle,

  tagline: {
    fontFamily,
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 25, // ~1.19
    letterSpacing: -0.1,
  } as TextStyle,

  body: {
    fontFamily,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 25, // ~1.47
  } as TextStyle,

  bodyStrong: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21, // ~1.24
  } as TextStyle,

  caption: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20, // ~1.43
  } as TextStyle,

  finePrint: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17, // ~1.40
  } as TextStyle,
} as const;
