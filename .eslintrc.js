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
    'no-console': 0,
    strict: 0,
  },
};
