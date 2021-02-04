"use strict";

const { argv } = require("yargs")
  .describe("username", "App store connect user to authenticate with")
  .describe("password", "Password for the given app store connect user")
  .describe("app-id", "ID of the app for which data will exported")
  .describe(
    "app-name",
    "Human-readable name of the app to use in exported data",
  )
  .describe("start-date", "First date to pull data for as YYYY-MM-DD")
  .describe(
    "end-date",
    "Last date to pull data for as YYYY-MM-DD (defaults to start-date if not given)",
  )
  .describe("project", "Bigquery project ID")
  .describe("dataset", "Bigquery dataset to save data to")
  .describe("overwrite", "Overwrite partition of destination table")
  .default("overwrite", false)
  .boolean("overwrite")
  .describe("allow-incomplete", "Allow export of incomplete day of data")
  .default("allow-incomplete", false)
  .boolean("allow-incomplete")
  .demandOption([
    "username",
    "password",
    "app-id",
    "app-name",
    "start-date",
    "project",
  ]);

const { AnalyticsClient } = require("./analyticsClient.js");
const { AnalyticsExport } = require("./analyticsExport.js");

async function startExport() {
  console.log(
    `Exporting ${argv.appName} (${argv.appId}) for ${argv.startDate} to ${argv.endDate} into ${argv.project}.${argv.dataset}`,
  );
  console.time("Export");

  const client = new AnalyticsClient();

  await client.login(argv.username, argv.password);

  const endDate = argv.endDate || argv.startDate;

  const analyticsExport = new AnalyticsExport(
    client,
    argv.project,
    argv.dataset,
    argv.appId,
    argv.appName,
  );

  await analyticsExport.startExport(
    argv.startDate,
    endDate,
    argv.overwrite,
    argv.allowIncomplete,
  );

  console.timeEnd("Export");
}

startExport()
  .then(() => {
    console.log("Successfully exported");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
