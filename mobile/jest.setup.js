/**
 * AsyncStorage's native binding does not exist under Jest, so it must be replaced with the
 * package's own mock before any module imports it.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
