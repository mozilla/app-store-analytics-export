/**
 * Mappings of metric names from the API to intenal display names
 * See link in https://bugzilla.mozilla.org/show_bug.cgi?id=1576788#c11
 */

const metricToTablePrefix = {
  activeDevices: {
    name: 'opt_in_active_devices',
    description: 'The number of devices with atleast one session during the selected period. Only devices with iOS 8 and tvOS 9 or later are included.',
  },
  crashes: {
    name: 'opt_in_crashes',
    description: 'The total number of crashes. Actual crash reports are available in xCode.',
  },
  impressionsTotal: {
    name: 'impressions',
    description: 'Number of times the app was viewed in the Featured, Categories, Top Charts and Search Sections of the App Store. Also includes views of the product page.',
  },
  impressionsTotalUnique: {
    name: 'impressions_unique_device',
    description: 'Number of times the app was viewed in the Featured, Categories, Top Charts and Search Sections of the App Store by unique device. Also includes views of the product page.',
  },
  installs: {
    name: 'opt_in_installations',
    description: 'The total number of times your app has been installed on an iOS device with iOS8 and tvOS 9 or later. Re-downloads on the same device, downloads to multiple devices sharing the same apple ID and Family Sharing installations are included. Updates are not included.',
  },
  optin: {
    name: 'opt_in_rate',
    description: 'Opt in rate of users who have agreed to share their diagnostic and usage information with app developers. This applies to installations, sessions, active devices, active last 30 days, crashes and deletions.Each day represents the average opt-in rate of all users who installed Apps during the last 30 days.',
  },
  pageViewCount: {
    name: 'product_page_views',
    description: 'Number of times the app\'s product page has been viewed on devices iOS 8 and tvOS 9 or later. Includes both App Store app and Storekit API',
  },
  pageViewUnique: {
    name: 'product_page_views_unique_device',
    description: 'Number of times the app\'s product page has been viewed on devices iOS 8 and tvOS 9 or later by unique device. Includes both App Store app and Storekit API',
  },
  rollingActiveDevices: {
    name: 'opt_in_active_devices_last_30_days',
    description: 'The total number of devices with atleast one session within 30 days of the selected day',
  },
  sessions: {
    name: 'opt_in_sessions',
    description: 'Opt-In. The number of times the app has been used for at least two seconds. If the app is in the background and is later used again that counts as another session.',
  },
  uninstalls: {
    name: 'opt_in_deletions',
    description: 'The number of times your app has been deleted on devices running iOS 12.3 or tvOS 13.0 or later.',
  },
  units: {
    name: 'app_units',
    description: 'The number of first-time app purchases made on the App Store using iOS 8 and tvOS 9 or later. Updates, re-downloads, download onto other devices are not counted. Family sharing downloads are included for free apps, but not for paid apps.',
  },
};

const dimensionToTableSuffix = {
  appReferrer: 'app_referrer',
  appVersion: 'app_version',
  campaignId: 'campaign',
  domainReferrer: 'web_referrer',
  platform: 'platform',
  platformVersion: 'platform_version',
  region: 'region',
  source: 'source',
  storefront: 'storefront',
};

exports.measureToTablePrefix = metricToTablePrefix;
exports.dimensionToTableSuffix = dimensionToTableSuffix;
