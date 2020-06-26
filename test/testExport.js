"use strict";

const analyticsExport = require("../analytics_export/analyticsExport.js");

const chai = require("chai");

chai.should();

describe("Export Functions", function () {
    it("should pass test", function () {
        analyticsExport.startExport().should.equal("test");
    });
});
