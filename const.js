const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ADVERTISER_ID = process.env.ADVERTISER_ID;
const DRYRUN = process.env.DRYRUN || 'YES';
const GROUP_TEST_ONLY = process.env.GROUP_TEST_ONLY || 'YES';
const TIKTOK_BASE_URL = 'https://business-api.tiktok.com'
const TEST_GROUP = [
    {
      adgroup_name:
        "C. Philippines L. English || General Dating || App || Purchase || Android || Test Manual Ad Group || Manual Creative",
      creative_material_mode: "CUSTOM",
      adgroup_id: "1830096301782322",
    },
    {
      adgroup_name:
        "Philippines L. English || General Dating || App || Purchase || Android || Test Ad Group || Smart Creative",
      creative_material_mode: "SMART_CREATIVE",
      adgroup_id: "1829719684525074",
    },
    {
        adgroup_id: "1830897501983745",
        creative_material_mode: "CUSTOM",
        adgroup_name: "C. Philippines L. English || General Dating || App || Purchase || Android || Static Image || Manual Creative || Test Group"
    },
    {
        adgroup_id: "1830897358117905",
        creative_material_mode: "CUSTOM",
        adgroup_name: "C. Philippines L. English || General Dating || App || Purchase || iOS || Static Image || Manual Creative || ADC || Test Group"
    }
  ];

module.exports = {ACCESS_TOKEN, ADVERTISER_ID, DRYRUN, GROUP_TEST_ONLY, TIKTOK_BASE_URL, TEST_GROUP}