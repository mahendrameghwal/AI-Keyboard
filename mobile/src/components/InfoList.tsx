import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Props {
  title?: string;
  items: readonly string[];
  testID?: string;
}

export function InfoList({ title, items, testID }: Props) {
  return (
    <View style={styles.section} testID={testID}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {items.map((item) => (
        <View key={item} style={styles.itemRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.item}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  bullet: {
    ...typography.body,
    color: colors.textMuted,
    marginRight: spacing.xs,
    lineHeight: 25,
  },
  item: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 25,
  },
});
