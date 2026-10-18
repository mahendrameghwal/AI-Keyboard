import { Platform } from 'react-native';
import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { KEYBOARD_SETUP } from '../features/disclosure/copy';

/**
 * Instructions only. Showing whether the keyboard is actually enabled needs the native
 * module (plan T6.4); until that exists this screen must not imply any status (FR-01).
 */
export default function KeyboardSetup() {
  const steps =
    Platform.OS === 'ios'
      ? [...KEYBOARD_SETUP.android, ...KEYBOARD_SETUP.ios]
      : [...KEYBOARD_SETUP.android];

  return (
    <Screen>
      <ScreenTitle testID="keyboard-setup-title">Enable the keyboard</ScreenTitle>
      <InfoList items={steps} testID="keyboard-setup-steps" />
      <InfoList
        items={[
          'The keyboard app itself is built in Phase 2; this screen lists the steps for when it is installed.',
        ]}
      />
    </Screen>
  );
}
