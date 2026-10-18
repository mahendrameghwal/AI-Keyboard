const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'expo-out/*', '.expo/*', 'android/*', 'ios/*'],
  },
];
