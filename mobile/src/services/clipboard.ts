import * as Clipboard from 'expo-clipboard';

/**
 * Clipboard behind a seam so screens never touch the module directly and can be tested
 * with a fake. Returns false instead of throwing: a failed copy is a message, not a crash.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
