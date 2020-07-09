'use strict';

const fetch = require('node-fetch');
const itc = require('itunesconnectanalytics');
const url = require('url');
const util = require('util');

const { BigqueryClient } = require('./bigqueryClient');
const { measureToTablePrefix, dimensionToTableSuffix } = require('./tableMetadata');
const { RequestError } = require('./requestError');

class AnalyticsExport {
  constructor(client, project, dataset, appId, appName) {
    this.client = client;
    this.project = project;
    this.dataset = dataset;
    this.appId = appId;
    this.appName = appName;
  }

  /**
   * Return a Map where key is a dimension key and value is an array of measure keys
   * that can be grouped by the dimension
   */
  async getAllowedDimensionsPerMeasure(date) {
    const getSettings = util.promisify(this.client.getSettings).bind(this.client);
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

    // Set null dimension to get ungrouped totals
    measuresByDimension.set(null, []);

    // Create mapping of dimensions to allowed measures
    settings.measures.forEach((measure) => {
      measure.dimensions.forEach((dimensionId) => {
        if (dimensionId in dimensionsById) {
          measuresByDimension.get(dimensionsById[dimensionId])
            .push(measure.key);
        }
      });
      measuresByDimension.get(null).push(measure.key);
    });

    return measuresByDimension;
  }

  async getMetric(date, measure, dimension) {
    console.log(`Getting ${measure} by ${dimension}`);

    const dimensionGiven = dimension !== undefined && dimension !== null;

    const measures = measure instanceof Array ? measure : [measure];
    const queryConfig = {
      measures,
      frequency: itc.frequency.days,
    };
    if (dimensionGiven) {
      queryConfig.group = { dimension };
    }
    const query = itc.AnalyticsQuery.metrics(this.appId, queryConfig).date(date, date);

    // Directly fetch instead of itc.request to avoid queue and properly handle errors
    const response = await fetch(
      url.parse(query.apiURL + query.endpoint),
      {
        method: 'POST',
        body: JSON.stringify(query.assembleBody()),
        headers: this.client.getHeaders(),
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
      .map((result) => {
        const value = {
          date,
          app_name: this.appName,
          value: result.totals.value,
        };
        if (dimensionGiven) {
          value[dimension] = result.group.title;
        }
        return value;
      });
  }

  /**
   * Pause thread for number of seconds; can be used for exponential backoff in requests
   */
  static async sleep(seconds) {
    return new Promise(((resolve) => setTimeout(resolve, seconds * 1000)));
  }

  async startExport(date, overwrite) {
    console.log('Starting export');

    const measuresByDimension = await this.getAllowedDimensionsPerMeasure(date)
      .catch((err) => { throw new Error(`Failed to get analytics metadata: ${err}`); });

    const bqClient = await BigqueryClient.createClient(this.project, this.dataset)
      .catch((err) => { throw Error(`Failed to create bigquery client: ${err}`); });

    // Run in for loop to synchronously send each request to avoid hitting rate limit
    for (const [dimension, measures] of measuresByDimension) {
      if (!(dimension in dimensionToTableSuffix)) {
        continue;
      }
      for (const measure of measures) {
        if (!(measure in measureToTablePrefix)) {
          continue;
        }
        let retry;
        let retryCount = 0;
        let data = null;
        do {
          retry = false;
          const retryDelay = 3 + 2 * 2 ** retryCount;
          try {
            data = await this.getMetric(date, measure, dimension);
          } catch (err) {
            console.error(`Failed to get ${measure} by ${dimension}: ${err.message}`);
            if (err.errorCode === 429) {
              console.error(`Retrying in ${retryDelay} seconds due to API rate limit`);
              retry = true;
              retryCount += 1;
            }
          }
          await AnalyticsExport.sleep(retryDelay);
          if (retryCount > 5 && retry === true) {
            console.error(`Failed to get ${measure} by ${dimension} after ${retryCount} attempts`);
            break;
          }
        } while (retry);

        if (data !== null && data.length > 0) {
          bqClient.writeData(measure, dimension, date, data, overwrite)
            .then((tableName) => console.log(`Wrote to table ${tableName}`))
            .catch((err) => {
              console.error(`Failed to write to table ${measure} by ${dimension}: ${err}`);
            });
        }
      }
    }
  }
}

exports.AnalyticExport = AnalyticsExport;
