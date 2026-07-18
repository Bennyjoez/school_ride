import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import noSecrets from "eslint-plugin-no-secrets";
import { fixupPluginRules } from "@eslint/compat"; // Correct import

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

  // React + hooks + secrets adjustments
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
      // Wrap legacy plugins with fixupPluginRules to make them ESLint v10-safe
      react: fixupPluginRules(reactPlugin),
      "react-hooks": fixupPluginRules(reactHooks),
      "react-refresh": reactRefresh,
      "no-secrets": noSecrets,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // Now safe to load because the underlying rules have been dynamically patched
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off", 
      "react/react-in-jsx-scope": "off", 

      // Secrets / credentials detection
      "no-secrets/no-secrets": [
        "error",
        {
          tolerance: 4.2, 
          additionalRegexes: {
            "Hardcoded token assignment":
              /(?:token|secret|password|api_?key|auth|credential)\s*[:=]\s*["'][A-Za-z0-9+/=_]{8,}/i,
            "Django secret key": /SECRET_KEY\s*=\s*["'][^"']{20,}/,
            "JWT token value":
              /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/,
            "FCM server key": /AAAA[A-Za-z0-9_]{7}:[A-Za-z0-9_]{140}/,
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
