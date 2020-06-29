'use strict';

const fetch = require('node-fetch');
const itc = require('itunesconnectanalytics');
const url = require('url');
const util = require('util');

const { BigqueryClient } = require('./bigqueryClient')

class RequestError extends Error {
  constructor(message, errorCode) {
    super(message);
    this.errorCode = errorCode;
  }
}

function toUnderscore(text) {
  return text
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, '$1_$2')
    .replace(/(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu, '$1_$2')
    .toLowerCase();
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

async function getMetric(client, date, appId, appName, measure, dimension) {
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
  if (response.ok === false) {
    throw new RequestError(
      `${response.status} ${response.statusText}
      \n${JSON.stringify(data.errors, null, 2) || ''}`,
      response.status,
    );
  }

  return data.results
    .filter((result) => result.totals.value !== -1)
    .map((result) => ({
      date,
      app_name: appName,
      value: result.totals.value,
      [toUnderscore(dimension)]: result.group.title,
    }));
}

/**
 * Pause thread for number of seconds; can be used for exponential backoff in requests
 */
async function sleep(seconds) {
  return new Promise(((resolve) => setTimeout(resolve, seconds * 1000)));
}

async function startExport(client, project, dataset, overwrite, appId, appName, date) {
  console.log('Starting export');

  const measuresByDimension = await getAllowedDimensionsPerMeasure(client, date)
    .catch((err) => { throw new Error(`Failed to get analytics metadata: ${err}`); });

  const bqClient = await BigqueryClient.createClient(project, dataset)
    .catch((err) => { throw Error(`Failed to create bigquery client: ${err}`); });

  // Run in for loop to synchronously send each request to avoid hitting rate limit
  for (const [dimension, measures] of measuresByDimension) {
    for (const measure of measures) {
      let retry;
      let retryCount = 0;
      let data = null;
      do {
        retry = false;
        const retryDelay = 3 + 2 * 2 ** retryCount;
        try {
          data = await getMetric(client, date, appId, appName, measure, dimension);
        } catch (err) {
          console.error(`Failed to get ${measure} by ${dimension}: ${err.message}`);
          if (err.errorCode === 429) {
            console.error(`Retrying in ${retryDelay} seconds due to API rate limit`);
            retry = true;
            retryCount += 1;
          }
        }
        await sleep(retryDelay);
        if (retryCount > 5 && retry === true) {
          console.error(`Failed to get ${measure} by ${dimension} after ${retryCount} attempts`);
          break;
        }
      } while (retry);

      if (data !== null && data.length > 0) {
        const tableName = `${toUnderscore(measure)}_by_${toUnderscore(dimension)}`;
        bqClient.writeData(tableName, date, data, toUnderscore(dimension), overwrite)
          .then(() => console.log(`Wrote to table ${tableName}`))
          .catch((err) => console.error(`Failed to write to table ${tableName}: ${err}`));
      }
    }
  }
}

exports.startExport = startExport;
