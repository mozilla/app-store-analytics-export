'use strict';

const { BigQuery } = require('@google-cloud/bigquery');

/**
 *  Wrapper around base bigquery client that handles all interaction logic
 */
class BigqueryClient {
  constructor(bqClient, dataset) {
    this.client = bqClient;
    this.dataset = dataset;
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

    return new BigqueryClient(bqClient, dataset);
  }

  async createTableIfNotExists(tableName, schema) {
    let table = this.dataset.table(tableName);
    const [tableExists] = await table.exists();

    if (tableExists === true) {
      return table;
    }

    const options = {
      schema,
      timePartitioning: {
        type: 'DAY',
        field: 'date',
      },
    };
    [table] = await this.dataset.createTable(tableName, options);
    console.log(`Created table ${table.id}`);
    return table;
  }

  async writeRows(tableName, date, data, dimension) {
    const schema = [
      { name: 'date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'app_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'value', type: 'STRING', mode: 'REQUIRED' },
      { name: dimension, type: 'STRING', mode: 'REQUIRED' },
    ];
    // TODO: overwrite partition
    const table = await this.createTableIfNotExists(tableName, schema);

    await table.insert(
      data,
      {
        schema,
      },
    );
  }
}

exports.BigqueryClient = BigqueryClient;
