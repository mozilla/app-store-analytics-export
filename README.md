# App Store Analytics Export

Scripts for exporting app analytics to BigQuery.
The export will export individual metrics grouped by a single dimension and load each
metric and dimension combination into a single table.
Metrics and dimensions that will be exported can be found in the 
[metric metadata file](analytics_export/tableMetadata.js).

A username and password for App Store Connect is required to use the script. 

## Usage

This project uses `yarn` to manage dependencies and was developed with nodejs 12.

To install dependencies use:
```sh
yarn
```

To run the export use `yarn export`.  Use `yarn export --help` to view supported options.

e.g.
```sh
yarn export \
    --username=u \
    --password=p \
    --app-id=123 \
    --app-name=app \
    --start-date=2020-01-01 \
    --project=test-project \
    --dataset=test-dataset
```

ESLint and Prettier are used for code formatting and linting.
Lint check can be run with:
```sh
yarn lint
```
And automatic fixing can be done with:
```sh
yarn lint-fix && yarn pretty
```

Tests are run with mocha:
```sh
yarn test
```