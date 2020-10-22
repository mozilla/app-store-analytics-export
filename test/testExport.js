"use strict";

const proxyquire = require("proxyquire");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { beforeEach, describe, it } = require("mocha");
const { spy, stub } = require("sinon");
const { FetchError } = require("node-fetch");

const { AnalyticsExport } = require("../analytics_export/analyticsExport");
const { RequestError } = require("../analytics_export/requestError");

chai.use(chaiAsPromised);
const { assert } = chai;

describe("Analytics export", () => {
  describe("getAllowedDimensionsPerMeasure", () => {
    let mockItcClient;
    let analyticsExport;

    beforeEach(() => {
      mockItcClient = {
        getSettings: () => {},
      };
      analyticsExport = new AnalyticsExport(
        mockItcClient,
        "project",
        "dataset",
        "123",
        "Firefox",
      );
    });

    it("should fail if given date with no data", async () => {
      stub(mockItcClient, "getSettings").callsArgWith(0, null, {
        configuration: {
          dataStartDate: "2020-01-02T00:00:00",
          dataEndDate: "2020-01-03T00:00:00",
        },
      });
      analyticsExport.client = mockItcClient;

      analyticsExport.getAllowedDimensionsPerMeasure = spy(
        analyticsExport,
        "getAllowedDimensionsPerMeasure",
      );

      await assert.isRejected(
        analyticsExport.getAllowedDimensionsPerMeasure(
          Date.parse("2020-01-01"),
          Date.parse("2020-01-02"),
          true,
        ),
        "Date out of range",
      );

      await assert.isRejected(
        analyticsExport.getAllowedDimensionsPerMeasure(
          Date.parse("2020-01-02"),
          Date.parse("2020-01-05"),
          true,
        ),
        "Date out of range",
      );

      await assert.isRejected(
        analyticsExport.getAllowedDimensionsPerMeasure(
          Date.parse("2019-01-02"),
          Date.parse("2019-01-02"),
          true,
        ),
        "Date out of range",
      );
    });

    it("should fail if data includes incomplete data for a day", async () => {
      stub(mockItcClient, "getSettings").callsArgWith(0, null, {
        configuration: {
          dataStartDate: "2020-01-02T00:00:00",
          dataEndDate: "2020-01-03T00:00:00",
        },
      });
      analyticsExport.client = mockItcClient;

      analyticsExport.getAllowedDimensionsPerMeasure = spy(
        analyticsExport,
        "getAllowedDimensionsPerMeasure",
      );

      await assert.isRejected(
        analyticsExport.getAllowedDimensionsPerMeasure(
          Date.parse("2020-01-03"),
          Date.parse("2020-01-03"),
          false,
        ),
        "has incomplete data",
      );
    });

    it("should allow incomplete data if argument is given", async () => {
      stub(mockItcClient, "getSettings").callsArgWith(0, null, {
        configuration: {
          dataStartDate: "2020-01-02T00:00:00",
          dataEndDate: "2020-01-03T00:00:00",
        },
        dimensions: [],
        measures: [],
      });
      analyticsExport.client = mockItcClient;

      analyticsExport.getAllowedDimensionsPerMeasure = spy(
        analyticsExport,
        "getAllowedDimensionsPerMeasure",
      );

      await analyticsExport.getAllowedDimensionsPerMeasure(
        Date.parse("2020-01-03"),
        Date.parse("2020-01-03"),
        true,
      );
    });

    it("should correctly group metrics with allowed dimensions", async () => {
      stub(mockItcClient, "getSettings").callsArgWith(0, null, {
        configuration: {
          dataStartDate: "2019-01-01T00:00:00",
          dataEndDate: "2021-01-01T00:00:00",
        },
        dimensions: [
          {
            id: 3,
            key: "appVersion",
            groupBy: true,
          },
          {
            id: 2,
            key: "platform",
            groupBy: true,
          },
          {
            id: 4,
            key: "platformVersion",
            groupBy: true,
          },
        ],
        measures: [
          {
            key: "impressionsTotal",
            dimensions: [1, 2, 3],
          },
          {
            key: "impressionsTotalUnique",
            dimensions: [1, 2],
          },
          {
            key: "pageViewCount",
            dimensions: [1, 3],
          },
        ],
      });
      analyticsExport.client = mockItcClient;

      const measuresByDimension = await analyticsExport.getAllowedDimensionsPerMeasure(
        Date.parse("2020-01-30"),
        Date.parse("2020-02-01"),
        true,
      );

      assert.lengthOf(measuresByDimension.get("appVersion"), 2);
      assert.include(measuresByDimension.get("appVersion"), "impressionsTotal");
      assert.include(measuresByDimension.get("appVersion"), "pageViewCount");

      assert.lengthOf(measuresByDimension.get("platform"), 2);
      assert.include(measuresByDimension.get("platform"), "impressionsTotal");
      assert.include(
        measuresByDimension.get("platform"),
        "impressionsTotalUnique",
      );

      assert.lengthOf(measuresByDimension.get("platformVersion"), 0);

      assert.lengthOf(measuresByDimension.get(null), 3);
      assert.include(measuresByDimension.get(null), "impressionsTotal");
      assert.include(measuresByDimension.get(null), "impressionsTotalUnique");
      assert.include(measuresByDimension.get(null), "pageViewCount");
    });
  });

  describe("metric fetching", () => {
    let analyticsExportProxy;
    let analyticsExport;

    beforeEach(() => {
      analyticsExportProxy = proxyquire(
        "../analytics_export/analyticsExport.js",
        {
          "./bigqueryClient": {
            BigqueryClient: {
              createClient: stub().resolves({}),
            },
          },
        },
      );

      analyticsExportProxy.AnalyticsExport.writeData = stub();
      analyticsExportProxy.AnalyticsExport.sleep = stub().resolves();

      analyticsExport = new analyticsExportProxy.AnalyticsExport(
        null,
        "project",
        "dataset",
        "appId",
        "appName",
      );
    });

    it("should retry query fetch on api rate limit errors with increasing backoff", async () => {
      analyticsExport.getAllowedDimensionsPerMeasure = stub().resolves([
        ["appVersion", ["impressionsTotal"]],
      ]);
      analyticsExport.getMetric = stub().throws(new RequestError("", 429));

      await analyticsExport
        .startExport("2020-01-01", "2020-01-01", true, true)
        .catch(() => {});

      assert.isTrue(analyticsExportProxy.AnalyticsExport.writeData.notCalled);
      assert.equal(analyticsExport.getMetric.callCount, 5);
      analyticsExportProxy.AnalyticsExport.sleep.args
        .map((arg) => arg[0])
        .reduce((prev, cur) => {
          assert.isTrue(cur > prev);
          return cur;
        }, 0);
    });

    it("should retry query fetch on FetchError", async () => {
      analyticsExport.getAllowedDimensionsPerMeasure = stub().resolves([
        ["appVersion", ["impressionsTotal"]],
      ]);
      analyticsExport.getMetric = stub().throws(new FetchError(""));

      await analyticsExport
        .startExport("2020-01-01", "2020-01-01", true, true)
        .catch(() => {});

      assert.isTrue(analyticsExportProxy.AnalyticsExport.writeData.notCalled);
      assert.equal(analyticsExport.getMetric.callCount, 5);
    });

    it("should not retry HTTP errors that are not due to api limit", async () => {
      analyticsExport.getAllowedDimensionsPerMeasure = stub().resolves([
        ["appVersion", ["impressionsTotal", "pageViewCount"]],
        ["platformVersion", ["impressionsTotal"]],
      ]);
      analyticsExport.getMetric = stub().throws(new RequestError("", 403));

      await analyticsExport
        .startExport("2020-01-01", "2020-01-01", true, true)
        .catch(() => {});

      assert.isTrue(analyticsExportProxy.AnalyticsExport.writeData.notCalled);
      assert.equal(analyticsExport.getMetric.callCount, 1);
    });

    it("should not fetch metrics and dimension that are not recognized in table metadata", async () => {
      analyticsExport.getAllowedDimensionsPerMeasure = stub().resolves([
        ["appVersion", ["impressionsTotal", "abcdef"]],
        ["defghi", ["impressionsTotal"]],
      ]);
      analyticsExport.getMetric = stub().resolves({});

      await analyticsExport.startExport("2020-01-01", "2020-01-01", true, true);

      assert.isTrue(analyticsExportProxy.AnalyticsExport.writeData.calledOnce);
      assert.equal(analyticsExport.getMetric.callCount, 1);
    });
  });
});
