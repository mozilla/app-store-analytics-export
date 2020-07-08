'use strict';

const fs = require('fs');
const tempy = require('tempy');
const { BigQuery } = require('@google-cloud/bigquery');

const { measureToTablePrefix, dimensionToTableSuffix } = require('./tableMetadata');

/**
 *  Wrapper around base bigquery client that handles all interaction logic
 */
class BigqueryClient {
  constructor(dataset) {
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

    return new BigqueryClient(dataset);
  }

  async createTableIfNotExists(tableName, schema, description) {
    let table = this.dataset.table(tableName);
    const [tableExists] = await table.exists();

    if (tableExists === true) {
      return table;
    }

    const options = {
      schema,
      description,
      timePartitioning: {
        type: 'DAY',
        field: 'date',
      },
    };
    [table] = await this.dataset.createTable(tableName, options);
    console.log(`Created table ${table.id}`);
    return table;
  }

  async writeData(measure, dimension, date, data, overwrite) {
    const schema = [
      { name: 'date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'app_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'value', type: 'STRING', mode: 'REQUIRED' },
    ];

    if (dimension !== null) {
      schema.push({ name: dimensionToTableSuffix[dimension], type: 'STRING', mode: 'REQUIRED' });
    }

    let tableName;
    if (dimension !== null) {
      tableName = `${measureToTablePrefix[measure].name}_by_${dimensionToTableSuffix[dimension]}`;
    } else {
      tableName = `${measureToTablePrefix[measure].name}_total`;
    }

    await this.createTableIfNotExists(
      tableName, schema, measureToTablePrefix[measure].description,
    );

    const csvData = data.map((entry) => {
      const rowData = [entry.date, entry.app_name, entry.value];
      if (dimension !== null) {
        rowData.push(entry[dimension]);
      }
      return rowData.join('\t');
    });
    const csvPath = tempy.file();
    fs.writeFileSync(csvPath, csvData.join('\n'));

    // Write to correct date partition
    const table = this.dataset.table(`${tableName}$${date.replace(/-/g, '')}`);

    await table.load(csvPath, {
      format: 'CSV',
      createDisposition: 'CREATE_NEVER',
      writeDisposition: overwrite ? 'WRITE_TRUNCATE' : 'WRITE_APPEND',
      fieldDelimiter: '\t',
      schema: {
        fields: schema,
      },
    });

    return tableName;
  }
}

exports.BigqueryClient = BigqueryClient;
