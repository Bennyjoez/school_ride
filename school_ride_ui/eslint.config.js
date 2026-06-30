import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import noSecrets from "eslint-plugin-no-secrets";

export default [
  // Files to ignore
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "*.min.js",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // React + hooks + secrets
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "no-secrets": noSecrets,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off", // Using TypeScript or JSDoc instead
      "react/react-in-jsx-scope": "off", // Not needed in React 17+

      // Secrets / credentials detection
      // Catches hardcoded API keys, tokens, passwords, private keys accidentally
      // committed into source files.
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.2, // Entropy threshold - lower = stricter
          additionalRegexes: {
            // Catch any variable that looks like it holds a token or key
            "Hardcoded token assignment":
              /(?:token|secret|password|api_?key|auth|credential)\s*[:=]\s*["'][A-Za-z0-9+/=_\-]{8,}/i,
            // Django SECRET_KEY pattern
            "Django secret key": /SECRET_KEY\s*=\s*["'][^"']{20,}/,
            // JWT patterns
            "JWT token value":
              /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
            // Firebase / FCM
            "FCM server key": /AAAA[A-Za-z0-9_\-]{7}:[A-Za-z0-9_\-]{140}/,
          },
        },
      ],

      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
];
