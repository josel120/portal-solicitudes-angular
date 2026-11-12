// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Module boundaries (the CLI-workspace equivalent of @nx/enforce-module-boundaries):
 * - a remote never imports another remote or the shell;
 * - everyone consumes the shared library only through its public API (`@portal/shared`);
 * - the shared library never imports application code.
 */
const deepSharedImport = {
  group: ['**/libs/shared/**', '@portal/shared/*'],
  message: 'Importa desde "@portal/shared" (API pública), no rutas internas de la librería.',
};
const appImport = (name) => ({
  group: [`**/projects/${name}/**`, `**/${name}/src/**`],
  message: `No importes código de ${name}: comunícate por el shell, la URL o el contrato de @portal/shared.`,
});

function boundaries(files, forbidden) {
  return {
    files,
    rules: { 'no-restricted-imports': ['error', { patterns: forbidden }] },
  };
}

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  boundaries(['projects/shell/**/*.ts'], [deepSharedImport, appImport('mfe-requests'), appImport('mfe-approvals')]),
  boundaries(['projects/mfe-requests/**/*.ts'], [deepSharedImport, appImport('shell'), appImport('mfe-approvals')]),
  boundaries(['projects/mfe-approvals/**/*.ts'], [deepSharedImport, appImport('shell'), appImport('mfe-requests')]),
  boundaries(['libs/shared/**/*.ts'], [appImport('shell'), appImport('mfe-requests'), appImport('mfe-approvals')]),
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/no-any': 'error',
    },
  },
);
