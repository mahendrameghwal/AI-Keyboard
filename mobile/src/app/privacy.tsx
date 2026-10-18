import { InfoList } from '../components/InfoList';
import { Screen, ScreenTitle } from '../components/Screen';
import { DISCLOSURE } from '../features/disclosure/copy';

export default function Privacy() {
  return (
    <Screen>
      <ScreenTitle testID="privacy-title">{DISCLOSURE.headline}</ScreenTitle>
      <InfoList items={DISCLOSURE.points} testID="privacy-disclosure" />
    </Screen>
  );
}
