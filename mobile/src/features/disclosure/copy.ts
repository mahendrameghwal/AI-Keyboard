/**
 * In-app disclosure copy (plan D1 / T8.5, SRS §16.1). Required before any store submission,
 * so it lives in one file the screens share rather than being paraphrased per view.
 */
export const DISCLOSURE = {
  headline: 'How your text and API key are handled',
  points: [
    "Your provider API key is stored only in this device's secure storage. It is never synced to your account and never sent to another app.",
    'Requests go through the AI Keyboard backend, which forwards your text and key to the provider you chose. The backend is not zero-knowledge: it sees the text while handling the request.',
    'The backend does not store your drafts, your text, or your key. It logs only a request id, the route, the status and how long the request took.',
    'You can remove your key at any time from Provider settings; the keyboard then stops sending AI requests until you add one again.',
  ],
} as const;

export const KEYBOARD_SETUP = {
  android: [
    'Android: Settings → System → Languages & input → On-screen keyboard → Manage keyboards → enable AI Keyboard, then switch to it from the keyboard icon.',
  ],
  ios: [
    'iOS: Settings → General → Keyboard → Add New Keyboard → AI Keyboard, then open any text field and tap the globe key. AI features need “Allow Full Access”.',
  ],
} as const;
