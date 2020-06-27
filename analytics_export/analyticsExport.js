'use strict';

const util = require('util');

// Retrieve list of measures and dimensions
async function getAnalyticsMetadata(client, date) {
  const getSettings = util.promisify(client.getSettings).bind(client);
  const settings = await getSettings();

  const executionDate = Date.parse(date);
  const dataEndDate = settings.configuration.dataEndDate.slice(0, 10);
  const dataStartDate = settings.configuration.dataStartDate.slice(0, 10);

  if (executionDate > Date.parse(dataEndDate) || executionDate < Date.parse(dataStartDate)) {
    throw Error(`No data found for ${date}; data exists for ${dataStartDate} to ${dataEndDate}`);
  }

  const dimensions = {};
  settings.dimensions.forEach((dimension) => {
    dimensions[dimension.id] = dimension;
  });

  const measures = {};
  settings.measures.forEach((measure) => {
    measures[measure.id] = measure;
  });

  return {
    dimensions,
    measures,
  };
}

async function startExport(client, appid, date) {
  console.log('Starting export');

  const metadata = await getAnalyticsMetadata(client, date)
    .catch((err) => { throw Error(`Failed to get analytics metadata: ${err}`); });

  util.debug(metadata);
}

exports.startExport = startExport;
