"use strict";

const fetch = require("node-fetch");
const readline = require("readline");
const url = require("url");

const { RequestError } = require("./requestError");

class AnalyticsClient {
  constructor() {
    this.apiBaseUrl = "https://appstoreconnect.apple.com/olympus/v1";
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/javascript, */*",
    };
    this.cookies = {};
  }

  /**
   * Extract given cookie key from the set-cookie header of the given response and
   * update class instance's cookies
   */
  setCookie(response, key) {
    try {
      const sessionInfo = new RegExp(`${key}=.+?;`)
        .exec(response.headers.get("set-cookie"))[0]
        .split("=");
      if (sessionInfo.length !== 2) {
        throw new TypeError();
      }
      [, this.cookies[sessionInfo[0]]] = sessionInfo;
    } catch (TypeError) {
      throw new Error(`Could not get ${key} cookie`);
    }
  }

  /**
   * Return default headers with cookie header set
   */
  getHeaders() {
    const cookies = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v};`)
      .join(" ");
    return { ...this.headers, Cookie: cookies };
  }

  /**
   * Check if the given response returned an error, throwing a RequestError
   * if there is an error
   */
  static checkResponseForError(response, startMessage, endMessage) {
    if (!response) {
      throw new RequestError(
        `${startMessage}: ${response.status} ${response.statusText} ${endMessage}`,
        response.status,
      );
    }
  }

  /**
   * Retrieve account and session cookies using username and password
   */
  async login(username, password) {
    const baseUrl = "https://idmsa.apple.com/appleauth/auth";
    const loginHeaders = {
      "X-Apple-Widget-Key":
        "e0b80c3bf78523bfe80974d320935bfa30add02e1bff88ec2166c6bd5a706c42",
    };

    // Initial login request
    let loginResponse = await fetch(
      `${baseUrl}/signin?isRememberMeEnabled=true`,
      {
        method: "POST",
        body: JSON.stringify({
          accountName: username,
          password,
          rememberMe: false,
        }),
        headers: { ...this.getHeaders(), ...loginHeaders },
      },
    );

    if (!loginResponse.ok && loginResponse.status === 409) {
      console.log("Attempting to handle 2-step verification");
      loginHeaders["X-Apple-ID-Session-Id"] = loginResponse.headers.get(
        "X-Apple-ID-Session-Id",
      );
      loginHeaders.scnt = loginResponse.headers.get("scnt");
      const codeRequestResponse = await fetch(baseUrl, {
        headers: { ...this.getHeaders(), ...loginHeaders },
      });

      if (!codeRequestResponse.ok) {
        if (codeRequestResponse.status === 423) {
          console.log(
            "Too many codes requested, try again later or use last code",
          );
        } else {
          AnalyticsClient.checkResponseForError(
            codeRequestResponse,
            "Error requesting 2SV code",
          );
        }
      }

      const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const code = await new Promise((resolve) => {
        prompt.question("Enter 2SV code: ", (input) => {
          resolve(input);
        });
      });
      prompt.close();

      if (code === "" || code === undefined) {
        throw new Error("No 2SV code given");
      }

      // 2SV response is used like the initial login response
      loginResponse = await fetch(`${baseUrl}/verify/phone/securitycode`, {
        method: "POST",
        body: JSON.stringify({
          mode: "sms",
          phoneNumber: { id: 1 },
          securityCode: {
            code,
          },
        }),
        headers: { ...this.getHeaders(), ...loginHeaders },
      });
    }

    if (!loginResponse.ok) {
      let message;
      if (loginResponse.status === 401) {
        message = "Invalid username and password";
      } else {
        message = "Unrecognized error";
      }
      AnalyticsClient.checkResponseForError(
        loginResponse,
        "Could not log in",
        message,
      );
    }

    // Get account info cookie
    this.setCookie(loginResponse, "myacinfo");

    // Request session cookie
    const sessionResponse = await fetch(
      url.parse(`${this.apiBaseUrl}/session`),
      {
        headers: this.getHeaders(),
      },
    );

    AnalyticsClient.checkResponseForError(
      sessionResponse,
      "Could not get session cookie",
    );

    this.setCookie(sessionResponse, "itctx");
  }

  /**
   * Throw an error if client has not been authenticated
   */
  isAuthenticated(name) {
    if (!this.cookies.myacinfo || !this.cookies.itctx) {
      throw new Error(
        `${name} function requires authentication; use login function first`,
      );
    }
  }

  /**
   * Retrieve API metadata (e.g. data date range, available metrics)
   */
  async getMetadata() {
    this.isAuthenticated("getMetadata");
    const settingsUrl =
      "https://analytics.itunes.apple.com/analytics/api/v1/settings/all";

    const settingsResponse = await fetch(settingsUrl, {
      headers: this.getHeaders(),
    });

    AnalyticsClient.checkResponseForError(
      settingsResponse,
      "Could not get API settings",
    );

    return settingsResponse.json();
  }
}

// TODO: Remove testing
const client = new AnalyticsClient();
client
  .login(process.argv[2], process.argv[3])
  .then(() => {
    console.log("fsddfs");
    client
      .getMetadata()
      .then((data) => {
        console.log(data);
      })
      .catch((err) => {
        console.error(err);
      });
  })
  .catch((err) => {
    console.error(`Login failed: ${err}`);
  });
