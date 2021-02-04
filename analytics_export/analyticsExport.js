"use strict";

const { FetchError } = require("node-fetch");

const { BigqueryClient } = require("./bigqueryClient");
const { metricData, dimensionToTableSuffix } = require("./tableMetadata");
const { RequestError } = require("./requestError");

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
  async getAllowedDimensionsPerMeasure(
    startTimestamp,
    endTimestamp,
    allowIncomplete,
  ) {
    const settings = await this.client.getMetadata();

    const dataEndDate = settings.configuration.dataEndDate.slice(0, 10);
    const dataStartDate = settings.configuration.dataStartDate.slice(0, 10);

    if (
      endTimestamp > Date.parse(dataEndDate) ||
      startTimestamp < Date.parse(dataStartDate)
    ) {
      throw Error(
        `Date out of range; data exists for ${dataStartDate} to ${dataEndDate}`,
      );
    }

    if (endTimestamp === Date.parse(dataEndDate)) {
      const warningString = `${dataEndDate} has incomplete data`;
      if (allowIncomplete) {
        console.log(warningString);
      } else {
        throw Error(`${warningString}; set --allowIncomplete to allow this`);
      }
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
          measuresByDimension
            .get(dimensionsById[dimensionId])
            .push(measure.key);
        }
      });
      measuresByDimension.get(null).push(measure.key);
    });

    return measuresByDimension;
  }

  async getMetric(startDate, endDate, metric, dimension) {
    console.log(`Getting ${metric} by ${dimension}`);

    const dimensionGiven = dimension !== undefined && dimension !== null;

    const data = await this.client.getMetric(
      this.appId,
      metric,
      dimension,
      startDate,
      endDate,
    );

    const resultsByDate = new Map();

    data.results
      .filter((result) => result.totals.value !== -1)
      .flatMap((result) =>
        result.data.map((dayData) => {
          const value = {
            date: dayData.date.slice(0, 10),
            app_name: this.appName,
            [metricData[metric].name]: dayData[metric],
          };
          if (dimensionGiven) {
            value[dimension] = result.group.title;
          }
          return value;
        }),
      )
      .forEach((value) => {
        if (!resultsByDate.has(value.date)) {
          resultsByDate.set(value.date, []);
        }
        resultsByDate.get(value.date).push(value);
      });

    return resultsByDate;
  }

  /**
   * Pause thread for number of seconds; can be used for exponential backoff in requests
   */
  static async sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  static async writeData(
    bqClient,
    appName,
    measure,
    dimension,
    dataByDate,
    overwrite,
  ) {
    await bqClient.createTableIfNotExists(measure, dimension);

    const writePromises = [];

    for (const [date, data] of dataByDate) {
      if (data.length === 0) {
        continue;
      }

      writePromises.push(
        bqClient
          .writeData(appName, measure, dimension, date, data, overwrite)
          .catch((err) => {
            console.error(
              `Failed to write to table ${measure} by ${dimension} for ${date}: ${err}`,
            );
            throw err;
          }),
      );
    }
    await Promise.all(writePromises);
  }

  async startExport(startDate, endDate, overwrite, allowIncomplete) {
    const parsedStartDate = Date.parse(startDate);
    const parsedEndDate = Date.parse(endDate);
    if (Number.isNaN(parsedStartDate) || Number.isNaN(parsedEndDate)) {
      throw Error("Execution dates must be given in the format YYYY-MM-DD");
    } else if (parsedStartDate > parsedEndDate) {
      throw Error("Start date must be before end date");
    }

    console.log("Starting export");

    const measuresByDimension = await this.getAllowedDimensionsPerMeasure(
      parsedStartDate,
      parsedEndDate,
      allowIncomplete,
    ).catch((err) => {
      throw new Error(`Failed to get analytics metadata: ${err}`);
    });

    const bqClient = await BigqueryClient.createClient(
      this.project,
      this.dataset,
    ).catch((err) => {
      throw new Error(`Failed to create bigquery client: ${err}`);
    });

    // Run in for loop to synchronously send each request to avoid hitting rate limit
    for (const [dimension, measures] of measuresByDimension) {
      if (!(dimension in dimensionToTableSuffix)) {
        continue;
      }
      for (const measure of measures.filter((m) => m in metricData)) {
        let retry;
        let retryCount = 0;
        let dataByDate = null;
        do {
          retry = false;
          const retryDelay = 3 + 2 * 2 ** retryCount;
          try {
            dataByDate = await this.getMetric(
              startDate,
              endDate,
              measure,
              dimension,
            );
          } catch (err) {
            console.error(
              `Failed to get ${measure} by ${dimension}: ${err.message}`,
            );
            if (err instanceof RequestError && err.errorCode === 429) {
              console.error(
                `Retrying in ${retryDelay} seconds due to API rate limit`,
              );
            } else if (
              err instanceof FetchError ||
              // 2020-11-17: App store API recently started returning 500s frequently
              // Apple support has been contacted so this is hopefully a temp workaround
              (err instanceof RequestError && err.errorCode === 500)
            ) {
              console.error(
                `Possibly intermittent error, retrying ${retryDelay} seconds`,
              );
              console.error(err);
            } else {
              throw err;
            }
            retry = true;
            retryCount += 1;
          }
          await AnalyticsExport.sleep(retryDelay);
          if (retryCount >= 5 && retry === true) {
            throw new Error(
              `Failed to get ${measure} by ${dimension} after ${retryCount} attempts`,
            );
          }
        } while (retry);

        if (dataByDate !== null) {
          await AnalyticsExport.writeData(
            bqClient,
            this.appName,
            measure,
            dimension,
            dataByDate,
            overwrite,
          );
          console.log(
            `Finished writing to table for ${measure} by ${dimension}`,
          );
        }
      }
    }
  }
}

exports.AnalyticsExport = AnalyticsExport;
