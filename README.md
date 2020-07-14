# App Store Analytics Export

Scripts for exporting app analytics to BigQuery.
The export will export individual metrics grouped by a single dimension and load each
metric and dimension combination into a single table.
Metrics and dimensions that will be exported can be found in the 
[metric metadata file](analytics_export/tableMetadata.js).

This export uses the 
[iTunesConnectAnalytics](https://github.com/JanHalozan/iTunesConnectAnalytics) package to handle authentication.
A username and password for App Store Connect is required to use the script. 

## Usage

This project uses `yarn` to manage dependencies and was developed with nodejs 12.

To install dependencies use:
```sh
yarn
```

To run the export use `yarn export` which takes the following arguments:
```sh
--help        Show help                                                 [boolean]
--version     Show version number                                       [boolean]
--username    App store connect user to authenticate with               [required]
--password    Password for the given app store connect user             [required]
--app-id      ID of the app for which data will exported                [required]
--app-name    Human-readable name of the app to use in exported data    [required]
--start-date  First date to pull data for as YYYY-MM-DD                 [required]
--end-date    Last date to pull data for as YYYY-MM-DD (defaults to start-date if not given)
--project     Bigquery project ID                                       [required]
--dataset     Bigquery dataset to save data to                          [default: "apple_app_store"]
--overwrite   Overwrite partition of destination table
```

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