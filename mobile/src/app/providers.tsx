import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Screen, ScreenTitle } from '../components/Screen';
import { ProviderSettings } from '../features/providers/settings';
import { useAppDeps } from '../services/deps';

export default function ProviderSettingsScreen() {
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const settings = useMemo(() => new ProviderSettings(deps), [deps]);

  const [selected, setSelected] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const rows = useQuery({ queryKey: ['provider-rows'], queryFn: () => settings.rows() });
  const selectedRow = rows.data?.find((row) => row.provider.id === selected);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['provider-rows'] });

  const onTest = async () => {
    if (!selectedRow) return;
    const result = await settings.test(selectedRow.provider, keyInput);
    setOutcome({ ok: result.valid, message: result.message });
  };

  const onSave = async () => {
    if (!selectedRow) return;
    try {
      await settings.saveAndSelect({
        provider: selectedRow.provider,
        rawKey: keyInput,
        model: modelInput === '' ? undefined : modelInput,
      });
      setKeyInput('');
      setOutcome({ ok: true, message: `Saved for ${selectedRow.provider.name}.` });
      await refresh();
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error ? error.message : 'Save failed.' });
    }
  };

  const onRemove = async (providerId: string) => {
    await settings.remove(providerId);
    if (selected === providerId) setSelected(null);
    await refresh();
  };

  return (
    <Screen>
      <ScreenTitle testID="providers-title">Provider settings</ScreenTitle>
      <ScrollView contentContainerStyle={styles.list}>
        {rows.isPending ? <Text testID="providers-loading">Loading providers…</Text> : null}
        {rows.isError ? (
          <Text testID="providers-error">
            {rows.error instanceof Error ? rows.error.message : 'Cannot load the provider list.'}
          </Text>
        ) : null}
        {rows.data?.map((row) => (
          <View key={row.provider.id} style={styles.row}>
            <TouchableOpacity
              testID={`provider-row-${row.provider.id}`}
              onPress={() => {
                setSelected(row.provider.id);
                setModelInput(row.provider.defaultModel);
                setOutcome(null);
              }}
            >
              <Text style={styles.providerName}>{row.provider.name}</Text>
              <Text style={styles.meta} testID={`provider-key-state-${row.provider.id}`}>
                {row.configured ? `Key stored: ${row.maskedKey}` : 'No key stored'}
              </Text>
            </TouchableOpacity>
            {row.deprecatedModels.length > 0 ? (
              <Text style={styles.meta}>Deprecated: {row.deprecatedModels.join(', ')}</Text>
            ) : null}
            {row.configured ? (
              <TouchableOpacity
                testID={`provider-remove-${row.provider.id}`}
                onPress={() => onRemove(row.provider.id)}
              >
                <Text style={styles.remove}>Remove key</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {selectedRow ? (
          <View style={styles.form}>
            <Text style={styles.meta}>Model</Text>
            <View style={styles.models}>
              {selectedRow.activeModels.map((model) => (
                <TouchableOpacity
                  key={model}
                  testID={`model-${model}`}
                  onPress={() => setModelInput(model)}
                  style={modelInput === model ? styles.modelActive : styles.model}
                >
                  <Text style={styles.modelText}>{model}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="key-input"
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="Provider API key"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TouchableOpacity testID="test-button" onPress={onTest} style={styles.button}>
              <Text style={styles.buttonText}>Test connection</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="save-button" onPress={onSave} style={styles.button}>
              <Text style={styles.buttonText}>Save and use</Text>
            </TouchableOpacity>
            {outcome ? (
              <Text testID="test-outcome" style={outcome.ok ? styles.outcomeOk : styles.outcomeBad}>
                {outcome.message}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 32 },
  row: { gap: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 12 },
  providerName: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13, color: '#6b7280' },
  remove: { fontSize: 14, color: '#b91c1c', marginTop: 4 },
  form: { gap: 10, marginTop: 8 },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  model: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f3f4f6' },
  modelActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#1d4ed8',
  },
  modelText: { fontSize: 13, color: '#111827' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: '600' },
  outcomeOk: { color: '#15803d' },
  outcomeBad: { color: '#b91c1c' },
});
