require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const csv = require("csv-parser");
const crypto = require("crypto");
const path = require("path");
const CsvLogger = require("./csvLogger");
const TikTokApiClient = require("./TikTokApiClient");
const { updateAdACO, getAdAcoDetail } = require("./ACO");
const {
    getSuggestedCoverImageId,
    searchAdGroupsByKeyword,
    getAdInfoFromAdGroup,
    prepareCreative,
    getTiktokOneVideoInfo,
    sendBatch,
} = require("./common");
const { DRYRUN, GROUP_TEST_ONLY, ADVERTISER_ID, TEST_GROUP } = require("./const");

const tiktokClient = new TikTokApiClient();

function processCSV(path) {
    console.log("DRY RUN: ", DRYRUN);
    const rows = [];
    fs.createReadStream(path)
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", async () => {
            console.log(`📋 Loaded ${rows.length} rows from CSV`);
            await ProcessTiktokOneVideos(rows);
        });
}

async function ProcessTiktokOneVideos(rows) {
    const csvLogger = new CsvLogger(
        "tiktok_one_video_ad_processing_report",
        "tiktok-one"
    );
    console.log(rows);
    if (!rows.length) {
        console.log("No rows to process");
        return;
    }

    for (const row of rows) {
        try {
            const TIMESTAMP = Math.floor(Date.now() / 1000);
            const videoInfo = await getTiktokOneVideoInfo(
                row.material_id,
                tiktokClient
            );
            const videoId = videoInfo.video_id;
            const originalFilename = `${videoInfo.file_name}.mp4`;
            const ad_name = videoInfo.file_name;
            await new Promise((res) => setTimeout(res, 5000)); // wait for 3 seconds
            const imageId = await getSuggestedCoverImageId(
                `${videoId}`,
                tiktokClient
            );

            const groups = await searchAdGroupsByKeyword(`${row.category} ${row.language}`,tiktokClient);

            console.log('groups: ', groups)
            for (const group of groups) {
                console.log(
                    `processing material_id ${row.material_id} - group ${group.adgroup_name}`
                );

                if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO' && (group.adgroup_id === '1830096301782322' || group.adgroup_id === '1829719684525074')){
                    csvLogger.logTiktokOneVideo(row.category, row.language,row.material_id,
                      {
                        create_ad_status: 'NOT_APPLICABLE',
                        adgroup_name: group.adgroup_name,
                        adgroup_id: group.adgroup_id,
                        error: 'skip test group'
                      }
                    )
                    continue // skip test ad group
                }
                if(/static\s+image/i.test(group.adgroup_name)){
                    console.log(`skip ad group ${group.adgroup_name}`)
                    csvLogger.logTiktokOneVideo(
                        row.category,
                        row.language,
                        row.material_id,
                        {
                            create_ad_status: 'NOT_APPLICABLE',
                            creative_material_mode: group.creative_material_mode,
                            adgroup_name: group.adgroup_name,
                            adgroup_id: group.adgroup_id,
                            error: 'NOT_APPLICABLE for Static Image adGroup'
                        }
                    )
                    continue // skip if ad group name has "Static Image" words
                  }

                if (group.creative_material_mode === "SMART_CREATIVE") {
                    let adAcoData;
                    try {
                        adAcoData = await getAdAcoDetail(ADVERTISER_ID, group.adgroup_id);
                    } catch (err) {
                        console.error(
                            `❌ Failed to get smart creative Ad Detail from group ${group.adgroup_id}:`,
                            err.response?.data || err.message
                        );
                        csvLogger.logTiktokOneVideo(
                            row.category,
                            row.language,
                            row.material_id,
                            {
                                create_ad_status: "FAILED",
                                creative_material_mode: group.creative_material_mode,
                                adgroup_name: group.adgroup_name,
                                adgroup_id: group.adgroup_id,
                                error: err.response?.data || err.message,
                            }
                        );
                    }

                    try {
                        const resp = await updateAdACO({
                            advertiserId: ADVERTISER_ID,
                            adgroupId: group.adgroup_id,
                            oldMediaInfoList: adAcoData.list[0].media_info_list,
                            newVideoId: videoId,
                            newVideoName: originalFilename,
                            newWebUris: imageId,
                        });
                        console.log(
                            `✅ update smart creative on ad group ${group.adgroup_name} - ${group.adgroup_id}`
                        );
                        csvLogger.logTiktokOneVideo(
                            row.category,
                            row.language,
                            row.material_id,
                            {
                                create_ad_status: "SUCCESS",
                                creative_material_mode: group.creative_material_mode,
                                adgroup_name: group.adgroup_name,
                                adgroup_id: group.adgroup_id,
                            }
                        );
                    } catch (err) {
                        console.error(
                            `❌ Failed to Update smart creative Ad for group ${group.adgroup_id}:`,
                            err.response?.data || err.message
                        );
                        csvLogger.logTiktokOneVideo(
                            row.category,
                            row.language,
                            row.material_id,
                            {
                                create_ad_status: "FAILED",
                                creative_material_mode: group.creative_material_mode,
                                adgroup_name: group.adgroup_name,
                                adgroup_id: group.adgroup_id,
                                video_id: videoId,
                                error: err.response?.data || err.message,
                            }
                        );
                    }
                } else {
                    const adInfo = await getAdInfoFromAdGroup(group.adgroup_id);
                    const creative = await prepareCreative(
                        { ...group, ad_name, format: "SINGLE_VIDEO" },
                        videoId,
                        imageId,
                        adInfo
                    );

                    try {
                        const res = await sendBatch(
                            group,
                            [creative.creative],
                            tiktokClient
                        );
                        csvLogger.logTiktokOneVideo(
                            row.category,
                            row.language,
                            row.material_id,
                            res
                        );
                    } catch (err) {
                        console.error(
                            `❌ Failed to create ad in group ${group.adgroup_id}:`,
                            err.response?.data || err.message
                        );
                        csvLogger.logTiktokOneVideo(
                            row.category,
                            row.language,
                            row.material_id,
                            {
                                create_ad_status: "FAILED",
                                creative_material_mode: group.creative_material_mode,
                                adgroup_name: group.adgroup_name,
                                adgroup_id: group.adgroup_id,
                                video_id: videoId,
                                error: err.response?.data || err.message,
                            }
                        );
                    }
                }
            }
        } catch (err) {
            console.log(err);
            csvLogger.logTiktokOneVideo(row.category, row.language, row.material_id, {
                error: err.response?.data || err.message,
            });
            console.error(`❌ Failed :`,err.response?.data || err.message);
        }
    }
}

const CSV_FILE = process.env.CSV_FILE || "test_tiktok_one_data.csv";
processCSV(CSV_FILE);
