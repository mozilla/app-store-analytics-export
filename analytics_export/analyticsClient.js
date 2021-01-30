"use strict";

const fetch = require("node-fetch");
const readline = require("readline");
const url = require("url");

const { RequestError } = require("./requestError");

class AnalyticsClient {
  apiBaseUrl = "https://appstoreconnect.apple.com/olympus/v1";

  headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/javascript, */*",
  };

  cookies = {};

  addCookie(key, value) {
    this.cookies[key] = value;
  }

  getCookies() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v};`)
      .join(" ");
  }

  extractCookie(response, key) {
    try {
      const sessionInfo = new RegExp(`${key}=.+?;`)
        .exec(response.headers.get("set-cookie"))[0]
        .split("=");
      if (sessionInfo.length !== 2) {
        throw new TypeError();
      }
      this.addCookie(sessionInfo[0], sessionInfo[1]);
    } catch (TypeError) {
      throw new Error(`Could not ${key} cookie`);
    }
  }

  getHeaders() {
    return { ...this.headers, Cookie: this.getCookies() };
  }

  async login(username, password) {
    const loginBaseUrl = "https://idmsa.apple.com/appleauth/auth";
    const loginHeaders = {
      "X-Apple-Widget-Key":
        "e0b80c3bf78523bfe80974d320935bfa30add02e1bff88ec2166c6bd5a706c42",
    };

    // Initial login request
    const loginResponse = await fetch(
      url.parse(loginBaseUrl + "/signin?isRememberMeEnabled=true"),
      {
        method: "POST",
        body: JSON.stringify({
          accountName: username,
          password: password,
          rememberMe: false,
        }),
        headers: { ...this.getHeaders(), ...loginHeaders },
      },
    );

    if (!loginResponse.ok && loginResponse.status === 409) {
      loginHeaders["X-Apple-ID-Session-Id"] = loginResponse.headers.get(
        "X-Apple-ID-Session-Id",
      );
      console.log("Attempting to handle 2-step verification");
      const codeRequestResponse = await fetch(loginBaseUrl, {
        headers: { ...this.getHeaders(), ...loginHeaders },
      });

      if (!codeRequestResponse.ok) {
        let message = "";
        if (codeRequestResponse.status === 423) {
          message =
            "Too many codes requested, try again later or use last code";
        }
        throw new RequestError(
          `Error requesting 2SV code: ${loginResponse.status} ${loginResponse.statusText} ${message}`,
          loginResponse.status,
        );
      }

      const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      let code;
      prompt.question("Enter 2SV code: ", (input) => {
        code = input;
      });
      console.log(code);

      // TODO: send back code
    } else if (!loginResponse.ok) {
      let message;
      if (loginResponse.status === 401) {
        message = "Invalid username and password";
      } else {
        message = "Unrecognized error";
      }
      throw new RequestError(
        `Could not log in: ${loginResponse.status} ${loginResponse.statusText} ${message}`,
        loginResponse.status,
      );
    }

    // Get account info cookie
    this.extractCookie(loginResponse, "myacinfo");

    // Request session cookie
    const sessionResponse = await fetch(
      url.parse(this.apiBaseUrl + "/session"),
      {
        headers: this.getHeaders(),
      },
    );

    if (!sessionResponse.ok) {
      throw new RequestError(
        `Could not get session cookie: ${loginResponse.status} ${loginResponse.statusText}`,
        sessionResponse.status,
      );
    }
    this.extractCookie(sessionResponse, "itctx");
  }
}

// TODO: Remove testing
let client = new AnalyticsClient();
client
  .login(process.argv[2], process.argv[3])
  .then((result) => {
    console.log("fsddfs");
  })
  .catch((err) => {
    console.error(`Login failed: ${err}`);
  });
