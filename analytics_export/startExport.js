'use strict';

const itc = require('itunesconnectanalytics');

const { argv } = require('yargs')
  .describe('username', 'App store connect user to authenticate with')
  .describe('password', 'Password for the given app store connect user')
  .describe('app-id', 'ID of the app for which data will exported')
  .describe('app-name', 'Human-readable name of the app to use in exported data')
  .describe('date', 'Execution date in YYYY-MM-DD')
  .describe('project', 'Bigquery project ID')
  .describe('dataset', 'Bigquery dataset to save data to')
  .default('dataset', 'apple_app_store')
  .describe('overwrite', 'Overwrite partition of destination table')
  .demandOption(['username', 'password', 'app-id', 'app-name', 'date', 'project']);

const { AnalyticExport } = require('./analyticsExport.js');

function authenticate(username, password) {
  return new Promise((resolve, reject) => {
    const client = new itc.Itunes(username, password, {
      errorCallback: (err) => {
        reject(err);
      },
      successCallback: () => {
        console.log('Logged in');
        resolve(client);
      },
    });
  });
}

authenticate(argv.username, argv.password)
  .then((client) => {
    const analyticsExport = new AnalyticExport(
      client, argv.project, argv.dataset,
      argv.appId, argv.appName,
    );

    analyticsExport.startExport(argv.date, argv.overwrite).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error(`Login failed: ${err}`);
    process.exit(1);
  });
