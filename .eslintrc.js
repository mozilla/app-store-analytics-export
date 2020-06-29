module.exports = {
  env: {
    es2020: true,
    node: true,
    amd: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'script',
  },
  rules: {
    'no-await-in-loop': 0,
    'no-console': 0,
    'no-restricted-syntax': 1,
    strict: 0,
  },
};
