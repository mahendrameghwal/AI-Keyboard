import { StyleSheet, Text, View } from 'react-native';

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
        <Text key={item} style={styles.item}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  item: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
});
