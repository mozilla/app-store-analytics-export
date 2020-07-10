"use strict";

const proxyquire = require("proxyquire");
const { assert } = require("chai");
const { beforeEach, describe, it } = require("mocha");
const { stub } = require("sinon");

const { BigqueryClient } = require("../analytics_export/bigqueryClient");

describe("BigqueryClient", () => {
  describe("factory", () => {
    const mockBigqueryClient = (mockDataset) =>
      proxyquire("../analytics_export/bigqueryClient.js", {
        "@google-cloud/bigquery": {
          BigQuery: stub().callsFake(() => ({
            dataset: stub().returns(mockDataset),
          })),
        },
      });

    it("should create the dataset if it does not exist", async () => {
      const mockDataset = {
        exists: stub().returns([false]),
        create: stub(),
      };

      const bigqueryClient = mockBigqueryClient(mockDataset);

      await bigqueryClient.BigqueryClient.createClient(
        "fake-project",
        "test_app_store",
      );

      assert.isTrue(mockDataset.exists.calledOnce);
      assert.isTrue(mockDataset.create.calledOnce);
    });

    it("should skip dataset creation if dataset exists", async () => {
      const mockDataset = {
        exists: stub().returns([true]),
        create: stub(),
      };

      const bigqueryClient = mockBigqueryClient(mockDataset);

      await bigqueryClient.BigqueryClient.createClient(
        "fake-project",
        "test_app_store",
      );

      assert.isTrue(mockDataset.exists.calledOnce);
      assert.isTrue(mockDataset.create.notCalled);
    });
  });

  describe("create table", () => {
    const tableName = "impressions_by_app_version";

    it("should create table if it does not exist", async () => {
      const mockTable = {
        exists: stub().returns([false]),
      };
      const mockDataset = {
        table: stub().returns(mockTable),
        createTable: stub().returns([tableName]),
      };
      const bigqueryClient = new BigqueryClient(mockDataset);

      await bigqueryClient.createTableIfNotExists(
        "impressionsTotal",
        "appVersion",
      );

      assert.isTrue(mockTable.exists.calledOnce);
      assert.isTrue(mockDataset.table.calledOnce);
      assert.isTrue(mockDataset.createTable.calledOnce);
      assert.isTrue(mockDataset.createTable.calledWith(tableName));
    });

    it("should skip table creation if table exists", async () => {
      const mockTable = {
        exists: stub().returns([true]),
      };
      const mockDataset = {
        table: stub().returns(mockTable),
        createTable: stub().returns([tableName]),
      };

      const bigqueryClient = new BigqueryClient(mockDataset);

      await bigqueryClient.createTableIfNotExists(
        "impressionsTotal",
        "appVersion",
      );

      assert.isTrue(mockTable.exists.calledOnce);
      assert.isTrue(mockDataset.table.calledOnce);
      assert.isTrue(mockDataset.createTable.notCalled);
    });
  });

  describe("write data", () => {
    let mockBigqueryClient;
    let mockTable;
    let mockDataset;
    let mockFs;

    beforeEach(() => {
      mockTable = {
        exists: stub().returns([true]),
        load: stub(),
      };
      mockDataset = {
        table: stub().returns(mockTable),
      };

      mockFs = {
        writeFileSync: stub(),
      };

      mockBigqueryClient = proxyquire("../analytics_export/bigqueryClient.js", {
        fs: mockFs,
        tempy: {
          file: () => "file.csv",
        },
      });
    });

    it("should give the correct table name based on measure and dimension", async () => {
      const bqClient = new mockBigqueryClient.BigqueryClient(mockDataset);

      const tableName = await bqClient.writeData(
        "impressionsTotal",
        "region",
        "2020-07-01",
        [],
        true,
      );

      assert.strictEqual(tableName, "impressions_by_region");
    });

    it("should give the correct table name for null dimensions", async () => {
      const bqClient = new mockBigqueryClient.BigqueryClient(mockDataset);

      const tableName = await bqClient.writeData(
        "impressionsTotal",
        null,
        "2020-07-01",
        [],
        true,
      );

      assert.strictEqual(tableName, "impressions_total");
    });

    it("should write the correct data to a temporary file", async () => {
      const bqClient = new mockBigqueryClient.BigqueryClient(mockDataset);

      const data = [
        {
          date: "2020-07-07",
          app_name: "Firefox",
          impressions: 1,
          region: "a",
        },
        {
          date: "2020-07-07",
          app_name: "Firefox",
          impressions: 2,
          region: "a",
        },
      ];

      await bqClient.writeData(
        "impressionsTotal",
        "region",
        "2020-07-01",
        data,
        true,
      );

      const writtenData =
        "2020-07-07\tFirefox\t1\ta\n2020-07-07\tFirefox\t2\ta";
      assert.isTrue(mockFs.writeFileSync.calledWith("file.csv", writtenData));
    });

    it("should write to a partition of the table", async () => {
      const bqClient = new mockBigqueryClient.BigqueryClient(mockDataset);
      bqClient.createTableIfNotExists = stub();

      const tableName = await bqClient.writeData(
        "impressionsTotal",
        "region",
        "2020-07-01",
        [],
        true,
      );

      assert.isTrue(mockDataset.table.calledOnce);
      assert.isTrue(
        mockDataset.table.calledOnceWithExactly(`${tableName}$20200701`),
      );
    });
  });
});
