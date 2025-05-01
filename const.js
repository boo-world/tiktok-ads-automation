const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ADVERTISER_ID = process.env.ADVERTISER_ID;
const DRYRUN = process.env.DRYRUN || 'YES';
const GROUP_TEST_ONLY = process.env.GROUP_TEST_ONLY || 'YES';
const TIKTOK_BASE_URL = 'https://business-api.tiktok.com'

module.exports = {ACCESS_TOKEN, ADVERTISER_ID, DRYRUN, GROUP_TEST_ONLY, TIKTOK_BASE_URL}