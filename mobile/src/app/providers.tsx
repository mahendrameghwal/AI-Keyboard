import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Screen, ScreenTitle } from '../components/Screen';
import { AppleButton, AppleCard, AppleInput } from '../components/ui';
import { ProviderSettings } from '../features/providers/settings';
import { API_BASE_URL } from '../services/api';
import { useAppDeps } from '../services/deps';
import { colors, radii, spacing, typography } from '../theme';

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
      <Text style={styles.subtitle}>
        Configure AI model providers. Your API keys are encrypted and stored solely on your device.
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {rows.isPending ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text testID="providers-loading" style={styles.loadingText}>
              Connecting to backend catalog…
            </Text>
          </View>
        ) : null}

        {rows.isError ? (
          <AppleCard surface="pearl" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Cannot load AI Providers</Text>
            <Text testID="providers-error" style={styles.errorMessage}>
              {rows.error instanceof Error ? rows.error.message : 'Cannot reach backend service.'}
            </Text>
            <Text style={styles.errorSub}>
              Target: {API_BASE_URL}
              {'\n'}Make sure the API server is running (`npm run api:dev`) and reachable on your Wi-Fi network.
            </Text>
            <AppleButton size="compact" variant="destructive" onPress={refresh} style={styles.retryBtn}>
              Retry Connection
            </AppleButton>
          </AppleCard>
        ) : null}

        {rows.data && rows.data.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Available Providers</Text>
            <AppleCard surface="pearl" padding="none" style={styles.groupCard}>
              {rows.data.map((row, index) => {
                const isCurrentSelected = selected === row.provider.id;
                const isLast = index === rows.data.length - 1;
                return (
                  <View
                    key={row.provider.id}
                    style={[
                      styles.rowContainer,
                      isCurrentSelected && styles.rowSelected,
                      !isLast && styles.rowBorder,
                    ]}
                  >
                    <TouchableOpacity
                      testID={`provider-row-${row.provider.id}`}
                      onPress={() => {
                        setSelected(row.provider.id);
                        setModelInput(row.provider.defaultModel);
                        setOutcome(null);
                      }}
                      style={styles.rowPressable}
                    >
                      <View style={styles.rowMain}>
                        <View style={styles.rowHeader}>
                          <Text style={styles.providerName}>{row.provider.name}</Text>
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: row.configured ? '#10B981' : colors.textMuted },
                            ]}
                          />
                        </View>
                        <Text style={styles.meta} testID={`provider-key-state-${row.provider.id}`}>
                          {row.configured ? `Key stored: ${row.maskedKey}` : 'No key stored'}
                        </Text>
                        {row.deprecatedModels.length > 0 ? (
                          <Text style={styles.deprecatedMeta}>
                            Deprecated: {row.deprecatedModels.join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {row.configured ? (
                      <TouchableOpacity
                        testID={`provider-remove-${row.provider.id}`}
                        onPress={() => onRemove(row.provider.id)}
                        style={styles.removeTouch}
                      >
                        <Text style={styles.remove}>Remove key</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </AppleCard>
          </View>
        ) : null}

        {selectedRow ? (
          <AppleCard surface="white" padding="md" style={styles.formCard}>
            <Text style={styles.formTitle}>Configure {selectedRow.provider.name}</Text>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Select Model</Text>
              <View style={styles.models}>
                {selectedRow.activeModels.map((model) => {
                  const isActive = modelInput === model;
                  return (
                    <TouchableOpacity
                      key={model}
                      testID={`model-${model}`}
                      onPress={() => setModelInput(model)}
                      style={[styles.modelPill, isActive ? styles.modelActive : styles.modelInactive]}
                    >
                      <Text style={[styles.modelText, isActive && styles.modelTextActive]}>
                        {model}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>API Key</Text>
              <AppleInput
                testID="key-input"
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder="Provider API key"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.buttonStack}>
              <AppleButton testID="test-button" variant="secondary" onPress={onTest}>
                Test connection
              </AppleButton>
              <AppleButton testID="save-button" variant="primary" onPress={onSave}>
                Save and use
              </AppleButton>
            </View>

            {outcome ? (
              <View
                style={[
                  styles.outcomeBox,
                  { backgroundColor: outcome.ok ? '#F0FDF4' : '#FEF2F2' },
                ]}
              >
                <Text
                  testID="test-outcome"
                  style={outcome.ok ? styles.outcomeOk : styles.outcomeBad}
                >
                  {outcome.message}
                </Text>
              </View>
            ) : null}
          </AppleCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.regular,
  },
  list: {
    gap: spacing.regular,
    paddingBottom: spacing.section,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: spacing.xs,
  },
  errorTitle: {
    ...typography.bodyStrong,
    color: colors.destructive,
  },
  errorMessage: {
    ...typography.body,
    color: colors.destructive,
  },
  errorSub: {
    ...typography.finePrint,
    color: colors.textMuted,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCard: {
    overflow: 'hidden',
  },
  rowContainer: {
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.md,
    backgroundColor: colors.pearl,
  },
  rowSelected: {
    backgroundColor: '#EEF2FF',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressable: {
    flex: 1,
  },
  rowMain: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerName: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deprecatedMeta: {
    ...typography.finePrint,
    color: colors.textMuted,
  },
  removeTouch: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  remove: {
    ...typography.caption,
    color: colors.destructive,
    fontWeight: '500',
  },
  formCard: {
    gap: spacing.md,
  },
  formTitle: {
    ...typography.tagline,
    color: colors.ink,
  },
  fieldSection: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.finePrint,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  models: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modelPill: {
    paddingHorizontal: spacing.regular,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  modelInactive: {
    backgroundColor: colors.pearl,
    borderColor: colors.border,
  },
  modelActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modelText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '500',
  },
  modelTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  buttonStack: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  outcomeBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  outcomeOk: {
    ...typography.caption,
    color: '#15803D',
    fontWeight: '600',
  },
  outcomeBad: {
    ...typography.caption,
    color: colors.destructive,
    fontWeight: '600',
  },
});
