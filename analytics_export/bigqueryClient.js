'use strict';

const fs = require('fs');
const tempy = require('tempy');
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

  async writeData(tableName, date, data, dimension, overwrite) {
    const schema = [
      { name: 'date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'app_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'value', type: 'STRING', mode: 'REQUIRED' },
      { name: dimension, type: 'STRING', mode: 'REQUIRED' },
    ];

    let table = await this.createTableIfNotExists(tableName, schema);

    const csvData = data.map((entry) => [
      entry.date, entry.app_name, entry.value, entry[dimension]].join('\t'));
    const csvPath = tempy.file();
    fs.writeFileSync(csvPath, csvData.join('\n'));

    table = this.dataset.table(`${tableName}$${date.replace(/-/g, '')}`);

    await table.load(csvPath, {
      format: 'CSV',
      createDisposition: 'CREATE_NEVER',
      writeDisposition: overwrite ? 'WRITE_TRUNCATE' : 'WRITE_APPEND',
      fieldDelimiter: '\t',
      schema: {
        fields: schema,
      },
    });
  }
}

exports.BigqueryClient = BigqueryClient;
