import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

export interface PillOption<T extends string> {
  id: T;
  label: string;
}

export interface SegmentedPillProps<T extends string> {
  options: ReadonlyArray<PillOption<T>>;
  selectedId: T;
  onSelect: (id: T) => void;
  scrollable?: boolean;
  testIDPrefix?: string;
}

export function SegmentedPill<T extends string>({
  options,
  selectedId,
  onSelect,
  scrollable = false,
  testIDPrefix,
}: SegmentedPillProps<T>): React.JSX.Element {
  const content = options.map((opt) => {
    const isSelected = opt.id === selectedId;
    return (
      <TouchableOpacity
        key={opt.id}
        testID={testIDPrefix ? `${testIDPrefix}-${opt.id}` : undefined}
        onPress={() => onSelect(opt.id)}
        style={[styles.pill, isSelected ? styles.pillSelected : styles.pillUnselected]}
      >
        <Text style={[styles.pillText, isSelected ? styles.textSelected : styles.textUnselected]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.regular,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillUnselected: {
    backgroundColor: colors.pearl,
    borderColor: colors.border,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '500',
  },
  textSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  textUnselected: {
    color: colors.ink,
  },
});
