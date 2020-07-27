"use strict";

const fs = require("fs");
const tempy = require("tempy");
const { BigQuery } = require("@google-cloud/bigquery");
const { Semaphore } = require("await-semaphore");

const { metricData, dimensionToTableSuffix } = require("./tableMetadata");

/**
 *  Wrapper around base bigquery client that handles all interaction logic
 */
class BigqueryClient {
  constructor(dataset) {
    this.dataset = dataset;
    // bigquery has a 100 concurrent request limit per method per user
    this.loadSemaphore = new Semaphore(50);
  }

  static async createClient(projectId, datasetId) {
    const bqClient = new BigQuery({
      projectId,
    });

    const dataset = bqClient.dataset(datasetId);
    const [datasetExists] = await dataset.exists();

    if (datasetExists === false) {
      await dataset.create();
      console.log(`Created dataset: ${datasetId}`);
    }

    return new BigqueryClient(dataset);
  }

  async createTableIfNotExists(measure, dimension) {
    const tableName = BigqueryClient.getTableName(measure, dimension);
    const schema = BigqueryClient.getSchema(measure, dimension);
    const { description } = metricData[measure];

    let table = this.dataset.table(tableName);
    const [tableExists] = await table.exists();

    if (tableExists === true) {
      return table;
    }

    const options = {
      schema,
      description,
      timePartitioning: {
        type: "DAY",
        field: "date",
      },
    };
    [table] = await this.dataset.createTable(tableName, options);
    console.log(`Created table ${table.id}`);
    return table;
  }

  static getTableName(measure, dimension) {
    const optin = metricData[measure].optin ? "opt_in_" : "";

    return dimension
      ? `${metricData[measure].name}_by_${optin}${dimensionToTableSuffix[dimension]}`
      : `${metricData[measure].name}_total`;
  }

  static getSchema(measure, dimension) {
    const schema = [
      { name: "date", type: "DATE", mode: "REQUIRED" },
      { name: "app_name", type: "STRING", mode: "REQUIRED" },
      {
        name: metricData[measure].name,
        type: metricData[measure].type,
        mode: "REQUIRED",
      },
    ];

    if (dimension) {
      schema.push({
        name: dimensionToTableSuffix[dimension],
        type: "STRING",
        mode: "REQUIRED",
      });
    }

    return schema;
  }

  async writeData(appName, measure, dimension, date, data, overwrite) {
    const schema = BigqueryClient.getSchema(measure, dimension);
    const tableName = BigqueryClient.getTableName(measure, dimension);

    const csvData = data.map((entry) => {
      const rowData = [
        entry.date,
        entry.app_name,
        entry[metricData[measure].name],
      ];
      if (dimension !== null) {
        rowData.push(entry[dimension]);
      }
      return rowData.join("\t");
    });
    const csvPath = tempy.file();
    fs.writeFileSync(csvPath, csvData.join("\n"));

    // Write to correct date partition
    const table = this.dataset.table(`${tableName}$${date.replace(/-/g, "")}`);

    await this.loadSemaphore.use(async () => {
      // Always delete data for the app for the day so that duplicate data isn't written
      await table.query(
        `DELETE FROM ${tableName} WHERE date = '${date}' AND app_name = '${appName}'`,
      );

      await table.load(csvPath, {
        format: "CSV",
        createDisposition: "CREATE_NEVER",
        writeDisposition: overwrite ? "WRITE_TRUNCATE" : "WRITE_APPEND",
        fieldDelimiter: "\t",
        schema: {
          fields: schema,
        },
      });
    });

    return tableName;
  }
}

exports.BigqueryClient = BigqueryClient;
