"use strict";

const argv = require("yargs")
    .describe("username", "App store connect user to authenticate with")
    .describe("password", "Password for the given app store connect user")
    .demandOption(["username", "password"])
    .argv;

const itc = require("itunesconnectanalytics");

console.log("placeholder");
