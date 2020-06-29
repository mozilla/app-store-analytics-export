'use strict';

const fetch = require('node-fetch');
const itc = require('itunesconnectanalytics');
const url = require('url');
const util = require('util');

class RequestError extends Error {
  constructor(message, errorCode) {
    super(message);
    this.errorCode = errorCode;
  }
}

/**
 * Return a Map where key is a dimension key and value is an array of measure keys
 * that can be grouped by the dimension
 */
async function getAllowedDimensionsPerMeasure(client, date) {
  const getSettings = util.promisify(client.getSettings).bind(client);
  const settings = await getSettings();

  const executionDate = Date.parse(date);
  const dataEndDate = settings.configuration.dataEndDate.slice(0, 10);
  const dataStartDate = settings.configuration.dataStartDate.slice(0, 10);

  if (executionDate > Date.parse(dataEndDate) || executionDate < Date.parse(dataStartDate)) {
    throw Error(`No data found for ${date}; data exists for ${dataStartDate} to ${dataEndDate}`);
  }

  const measuresByDimension = new Map();
  const dimensionsById = {};

  // Create number id to key mapping
  settings.dimensions.forEach((dimension) => {
    if (dimension.groupBy) {
      dimensionsById[dimension.id] = dimension.key;
      measuresByDimension.set(dimension.key, []);
    }
  });

  // Create mapping of dimensions to allowed measures
  settings.measures.forEach((measure) => {
    measure.dimensions.forEach((dimensionId) => {
      if (dimensionId in dimensionsById) {
        measuresByDimension.get(dimensionsById[dimensionId])
          .push(measure.key);
      }
    });
  });

  return measuresByDimension;
}

async function getMetric(client, date, appId, measure, dimension) {
  console.log(`Getting ${measure} by ${dimension}`);

  const measures = measure instanceof Array ? measure : [measure];

  const query = itc.AnalyticsQuery.metrics(appId, {
    measures,
    group: {
      dimension,
    },
    frequency: itc.frequency.days,
  }).date(date, date);

  // Directly fetch instead of itc.request to avoid queue and properly handle errors
  const response = await fetch(
    url.parse(query.apiURL + query.endpoint),
    {
      method: 'POST',
      body: JSON.stringify(query.assembleBody()),
      headers: client.getHeaders(),
    },
  );
  const data = await response.json();
  if (response.ok) {
    return data;
  }
  throw new RequestError(
    `${response.status} ${response.statusText}
    \n${JSON.stringify(data.errors, null, 2) || ''}`,
    response.status,
  );
}

async function sleep(seconds) {
  return new Promise(((resolve) => setTimeout(resolve, seconds * 1000)));
}

async function startExport(client, appId, date) {
  console.log('Starting export');

  const measuresByDimension = await getAllowedDimensionsPerMeasure(client, date)
    .catch((err) => { throw new Error(`Failed to get analytics metadata: ${err}`); });

  // Run in for loop to synchronously send each request to avoid hitting rate limit
  for (const [dimension, measures] of measuresByDimension) {
    for (const measure of measures) {
      let retry = false;
      let retryCount = 0;
      let data = null;
      do {
        const retryDelay = 5 + 2 * 2 ** retryCount;
        data = await getMetric(client, date, appId, measure, dimension)
          // eslint-disable-next-line no-loop-func
          .catch((err) => {
            console.error(`Failed to get ${measure} grouped by ${dimension}: ${err.message}`);
            if (err.errorCode === 429) {
              console.error(`Retrying in ${retryDelay} seconds due to API rate limit`);
              retry = true;
            }
          });
        await sleep(retryDelay);
        retryCount += 1;
        if (retryCount >= 5 && retry) {
          console.error(`Failed to get metrics after ${retryCount} attempts`);
          break;
        }
      } while (retry);
      if (data !== null) {
        // write to bq
      }
    }
  }
}

exports.startExport = startExport;
