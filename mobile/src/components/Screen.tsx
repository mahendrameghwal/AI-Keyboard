import { StyleSheet, Text, View, type ViewProps } from 'react-native';

export function Screen({ children, ...rest }: ViewProps) {
  return (
    <View style={styles.screen} {...rest}>
      {children}
    </View>
  );
}

export function ScreenTitle({ testID, children }: { testID?: string; children: string }) {
  return (
    <Text style={styles.title} testID={testID}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
});
