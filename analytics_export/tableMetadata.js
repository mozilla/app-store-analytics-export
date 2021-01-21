/**
 * Mappings of metric names from the API to intenally used values
 * See link in https://bugzilla.mozilla.org/show_bug.cgi?id=1576788#c11
 */

const metricData = {
  activeDevices: {
    name: "active_devices",
    description:
      "The number of devices with atleast one session during the selected period. Only devices with iOS 8 and tvOS 9 or later are included.",
    optin: true,
    type: "INT64",
  },
  crashes: {
    name: "crashes",
    description:
      "The total number of crashes. Actual crash reports are available in xCode.",
    optin: true,
    type: "INT64",
  },
  iap: {
    name: "iap",
    description:
      "The number of first time purchases of an in-app purchase on a device using iOS8 and tvOS 9 or later. Restored in-app purchases are not counted.",
    optin: false,
    type: "INT64",
  },
  impressionsTotal: {
    name: "impressions",
    description:
      "Number of times the app was viewed in the Featured, Categories, Top Charts and Search Sections of the App Store. Also includes views of the product page.",
    optin: false,
    type: "INT64",
  },
  impressionsTotalUnique: {
    name: "impressions_unique_device",
    description:
      "Number of times the app was viewed in the Featured, Categories, Top Charts and Search Sections of the App Store by unique device. Also includes views of the product page.",
    optin: false,
    type: "INT64",
  },
  installs: {
    name: "installations",
    description:
      "The total number of times your app has been installed on an iOS device with iOS8 and tvOS 9 or later. Re-downloads on the same device, downloads to multiple devices sharing the same apple ID and Family Sharing installations are included. Updates are not included.",
    optin: true,
    type: "INT64",
  },
  optin: {
    name: "rate",
    description:
      "Opt in rate of users who have agreed to share their diagnostic and usage information with app developers. This applies to installations, sessions, active devices, active last 30 days, crashes and deletions.Each day represents the average opt-in rate of all users who installed Apps during the last 30 days.",
    optin: true,
    type: "FLOAT64",
  },
  pageViewCount: {
    name: "product_page_views",
    description:
      "Number of times the app's product page has been viewed on devices iOS 8 and tvOS 9 or later. Includes both App Store app and Storekit API",
    optin: false,
    type: "INT64",
  },
  pageViewUnique: {
    name: "product_page_views_unique_device",
    description:
      "Number of times the app's product page has been viewed on devices iOS 8 and tvOS 9 or later by unique device. Includes both App Store app and Storekit API",
    optin: false,
    type: "INT64",
  },
  payingUsers: {
    name: "paying_users",
    description:
      "The number of unique users that paid for an app or in-app purchase.",
    optin: false,
    type: "INT64",
  },
  rollingActiveDevices: {
    name: "active_devices_last_30_days",
    description:
      "The total number of devices with atleast one session within 30 days of the selected day",
    optin: true,
    type: "INT64",
  },
  sales: {
    name: "sales",
    description:
      "The total amount billed to customers for purchasing apps, app bundles, and in-app purchases. Taxes are only included in the sales if those taxes were included in the App Store price. Not the same as proceeds (sales including Apple's 30% cut)",
    optin: false,
    type: "INT64",
  },
  sessions: {
    name: "sessions",
    description:
      "Opt-In. The number of times the app has been used for at least two seconds. If the app is in the background and is later used again that counts as another session.",
    optin: true,
    type: "INT64",
  },
  uninstalls: {
    name: "deletions",
    description:
      "The number of times your app has been deleted on devices running iOS 12.3 or tvOS 13.0 or later.",
    optin: true,
    type: "INT64",
  },
  units: {
    name: "app_units",
    description:
      "The number of first-time app purchases made on the App Store using iOS 8 and tvOS 9 or later. Updates, re-downloads, download onto other devices are not counted. Family sharing downloads are included for free apps, but not for paid apps.",
    optin: false,
    type: "INT64",
  },
};

const dimensionToTableSuffix = {
  appReferrer: "app_referrer",
  appVersion: "app_version",
  campaignId: "campaign",
  domainReferrer: "web_referrer",
  platform: "platform",
  platformVersion: "platform_version",
  region: "region",
  source: "source",
  storefront: "storefront",
  [null]: "",
};

exports.metricData = metricData;
exports.dimensionToTableSuffix = dimensionToTableSuffix;
