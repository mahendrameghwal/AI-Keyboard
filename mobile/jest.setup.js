/**
 * AsyncStorage's native binding does not exist under Jest, so it must be replaced with the
 * package's own mock before any module imports it.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * `src/services/api.ts` refuses to load without a base URL (a build that silently used to
 * dial localhost is the bug this guards against). `Constants.expoConfig` is null under Jest,
 * so the test run supplies the local-development value the same way `mobile/.env` does.
 */
process.env.EXPO_PUBLIC_API_BASE_URL ??= 'http://localhost:3000';
