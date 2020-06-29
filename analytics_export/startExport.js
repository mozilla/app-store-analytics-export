'use strict';

const itc = require('itunesconnectanalytics');
const argv = require('yargs')
  .describe('username', 'App store connect user to authenticate with')
  .describe('password', 'Password for the given app store connect user')
  .describe('app-id', 'ID of the app for which data will exported')
  .describe('date', 'Execution date in YYYY-MM-DD')
  .demandOption(['username', 'password', 'app-id', 'date'])
  .argv;

const analyticsExport = require('./analyticsExport.js');

function authenticateAndExport(username, password) {
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

authenticateAndExport(argv.username, argv.password)
  .catch((err) => {
    console.error(`Login failed: ${err}`);
    process.exit(1);
  })
  .then((client) => analyticsExport.startExport(client, argv.appId, argv.date))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
