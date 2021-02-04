"use strict";

const proxyquire = require("proxyquire");
const { assert } = require("chai");
const { beforeEach, describe, it } = require("mocha");
const { stub } = require("sinon");

const { AnalyticsClient } = require("../analytics_export/analyticsClient");
const { RequestError } = require("../analytics_export/requestError");

describe("AnalyticsClient", () => {
  let testClient;

  beforeEach(() => {
    testClient = new AnalyticsClient();
  });

  describe("authentication check", () => {
    it("should succeed account and session cookies are both set", () => {
      testClient.cookies.itctx = "it";
      testClient.cookies.myacinfo = "ac";
      assert.doesNotThrow(() => testClient.isAuthenticated("test"));
    });

    it("should fail if both account and session cookies are not set", () => {
      assert.throws(
        () => testClient.isAuthenticated("test"),
        "test function requires authentication",
      );
    });

    it("should fail if account cookie is not set", () => {
      testClient.cookies.itctx = "it";
      assert.throws(
        () => testClient.isAuthenticated("test"),
        "test function requires authentication",
      );
    });

    it("should fail if session cookies is not set", () => {
      testClient.cookies.myacinfo = "ac";
      assert.throws(
        () => testClient.isAuthenticated("test"),
        "test function requires authentication",
      );
    });

    it("should fail if a cookie was set to null", () => {
      testClient.cookies.itctx = null;
      assert.throws(
        () => testClient.isAuthenticated("test"),
        "test function requires authentication",
      );
    });
  });

  describe("response error check", () => {
    it("should throw if response has failure", () => {
      const response = { ok: false };
      assert.throws(
        () => AnalyticsClient.checkResponseForError(response),
        RequestError,
      );
    });

    it("should succeed if response succeeded", () => {
      const response = { ok: true };
      assert.doesNotThrow(() =>
        AnalyticsClient.checkResponseForError(response),
      );
    });

    it("should throw if response is null", () => {
      assert.throws(
        () => AnalyticsClient.checkResponseForError(null),
        TypeError,
      );
    });
  });

  describe("set cookies", () => {
    it("should set all cookies in the set-cookie header", () => {
      testClient.setCookies({
        headers: new Map([["set-cookie", "abc=123; def=456;"]]),
      });
      assert.equal(testClient.cookies.abc, "123;");
      assert.equal(testClient.cookies.def, "456;");
    });

    it("should update existing cookies", () => {
      testClient.cookies.abc = "123;";
      testClient.setCookies({
        headers: new Map([["set-cookie", "abc=456;"]]),
      });
      assert.equal(testClient.cookies.abc, "456;");
    });
  });

  describe("get headers", () => {
    it("should return default headers plus cookies", () => {
      testClient.defaultHeaders = {
        testHeader: "1",
      };
      testClient.cookies = {
        testCookie: "2;",
      };
      const actual = testClient.headers;
      const expected = {
        testHeader: "1",
        Cookie: "testCookie=2;",
      };

      for (const [key, value] of Object.entries(actual)) {
        assert.equal(value, expected[key]);
      }
    });
  });

  describe("login", () => {
    // fetch calls will return data arguments in the given order
    const mockFetch = (...data) => {
      const fetchStub = stub();
      for (let i = 0; i < data.length; i += 1) {
        fetchStub.onCall(i).returns(data[i]);
      }

      return proxyquire("../analytics_export/analyticsClient.js", {
        "node-fetch": fetchStub,
      });
    };

    it("should get account and session cookies on regular login", async () => {
      const MockAnalyticsClient = mockFetch(
        { ok: true, headers: new Map([["set-cookie", "myacinfo=acc;"]]) }, // login
        { ok: true, headers: new Map([["set-cookie", "itctx=sess;"]]) }, // get session
      ).AnalyticsClient;

      testClient = new MockAnalyticsClient();

      await testClient.login("username", "password");

      assert.equal(testClient.cookies.myacinfo, "acc;");
      assert.equal(testClient.cookies.itctx, "sess;");
    });

    it("should get account and session cookies on 2SV bypass", async () => {
      const MockAnalyticsClient = mockFetch(
        { ok: false, status: 412, headers: new Map() }, // login
        { ok: true, headers: new Map([["set-cookie", "myacinfo=acc;"]]) }, // bypass 2sv
        { ok: true, headers: new Map([["set-cookie", "itctx=sess;"]]) }, // session
      ).AnalyticsClient;

      testClient = new MockAnalyticsClient();

      await testClient.login("username", "password");

      assert.equal(testClient.cookies.myacinfo, "acc;");
      assert.equal(testClient.cookies.itctx, "sess;");
    });

    it("should get account and session cookies on 2SV request", async () => {
      const MockAnalyticsClient = mockFetch(
        { ok: false, status: 409, headers: new Map() }, // login
        { ok: true, headers: new Map() }, // request 2sv code
        { ok: true, headers: new Map([["set-cookie", "myacinfo=acc;"]]) }, // send code
        { ok: true, headers: new Map([["set-cookie", "itctx=sess;"]]) }, // session
      ).AnalyticsClient;

      testClient = new MockAnalyticsClient();

      await testClient.login("username", "password", "123456");

      assert.equal(testClient.cookies.myacinfo, "acc;");
      assert.equal(testClient.cookies.itctx, "sess;");
    });
  });
});
