const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // jest.setup.js runs outside any module scope, so the Jest globals are not visible to ESLint.
    files: ['jest.setup.js', '__tests__/**/*', 'test/**/*'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/*', 'expo-out/*', '.expo/*', 'android/*', 'ios/*'],
  },
];
