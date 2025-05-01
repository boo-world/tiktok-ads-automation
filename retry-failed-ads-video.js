require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const crypto = require('crypto');
const path = require('path');
const CsvLogger = require('./csvLogger');
const TikTokApiClient = require('./TikTokApiClient');
const {updateAdACO, getAdAcoDetail} = require('./ACO')
const { getSuggestedCoverImageId, searchAdGroupsById, getAdInfoFromAdGroup, prepareCreative, getVideoInfo, sendBatch } = require('./common')
const { DRYRUN, GROUP_TEST_ONLY, ADVERTISER_ID } = require('./const')

const tiktokClient = new TikTokApiClient();

function processCSV(path) {
    console.log('DRY RUN: ', DRYRUN)
    const rows = [];
    fs.createReadStream(path)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        console.log(`📋 Loaded ${rows.length} rows from CSV`);
        await retryProcessAds(rows);
      });
  }

  async function retryProcessAds(rows) {
    const csvLogger = new CsvLogger('retry_video_ad_processing_report', 'retry-video');
    console.log(rows)
    if (!rows.length) {
      console.log('No rows to process');
      return;
    }
  
    for (const row of rows) {
  
      try {
        const TIMESTAMP = Math.floor(Date.now() / 1000);
        const videoId = row.video_id
        const videoInfo = await getVideoInfo(videoId, tiktokClient)
        const originalFilename = `${videoInfo.file_name}.mp4`
        const ad_name = videoInfo.file_name
        await new Promise(res => setTimeout(res, 5000)); // wait for 3 seconds
        const imageId = await getSuggestedCoverImageId(`${videoId}`, tiktokClient);
  
        const group = await searchAdGroupsById(row.ad_group_id, tiktokClient);

        console.log(`processing group ${row.ad_group_id} - video ${videoId}`)

        // if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO' && (group.adgroup_id === '1830096301782322' || group.adgroup_id === '1829719684525074')){
        //     csvLogger.logRetryVideo(row.ad_group_id, row.video_id,
        //       {
        //         create_ad_status: 'NOT_APPLICABLE',
        //         adgroup_name: group.adgroup_name,
        //         adgroup_id: group.adgroup_id,
        //         error: 'skip test group'
        //       }
        //     )
        //     continue // skip test ad group
        //   }

        if(group.creative_material_mode === 'SMART_CREATIVE'){
            let adAcoData
            try {
              adAcoData = await getAdAcoDetail(ADVERTISER_ID, group.adgroup_id);
            } catch (err) {
              console.error(`❌ Failed to get smart creative Ad Detail from group ${group.adgroup_id}:`, err.response?.data || err.message);
              csvLogger.logRetryVideo(row.ad_group_id, row.video_id,{
                create_ad_status: 'FAILED',
                creative_material_mode: group.creative_material_mode,
                adgroup_name: group.adgroup_name,
                adgroup_id: group.adgroup_id,
                error: err.response?.data || err.message
              })
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
                console.log(`✅ update smart creative on ad group ${group.adgroup_name} - ${group.adgroup_id}`);
                csvLogger.logRetryVideo(row.ad_group_id, row.video_id,{
                  create_ad_status: 'SUCCESS',
                  creative_material_mode: group.creative_material_mode,
                  adgroup_name: group.adgroup_name,
                  adgroup_id: group.adgroup_id,
                })
            } catch (err) {
              console.error(`❌ Failed to Update smart creative Ad for group ${group.adgroup_id}:`, err.response?.data || err.message);
              csvLogger.logRetryVideo(row.ad_group_id, row.video_id,{
                create_ad_status: 'FAILED',
                creative_material_mode: group.creative_material_mode,
                adgroup_name: group.adgroup_name,
                adgroup_id: group.adgroup_id,
                video_id: videoId,
                error: err.response?.data || err.message
              })
            }
          }else{
            const adInfo = await getAdInfoFromAdGroup(group.adgroup_id);
            const creative = await prepareCreative(
              { ...group, ad_name, format: 'SINGLE_VIDEO' },
              videoId,
              imageId,
              adInfo
            );
  
            try {
              const res = await sendBatch(group, [creative.creative], tiktokClient);
              csvLogger.logRetryVideo(row.ad_group_id, row.video_id,res)
            } catch (err) {
              console.error(`❌ Failed to create ad in group ${group.adgroup_id}:`, err.response?.data || err.message);
              csvLogger.logRetryVideo(row.ad_group_id, row.video_id,{
                create_ad_status: 'FAILED',
                creative_material_mode: group.creative_material_mode,
                adgroup_name: group.adgroup_name,
                adgroup_id: group.adgroup_id,
                video_id: videoId,
                error: err.response?.data || err.message
              })
            }
          }
      } catch (err) {
        console.log(err)
        csvLogger.logRetryVideo(row.ad_group_id, row.video_id,{
          error: err.response?.data || err.message
        })
        console.error(`❌ Failed processing video: ${videoUrl}`, err.response?.data || err.message);
      }
    }
  }

  const CSV_FILE = process.env.CSV_FILE || 'test_retry_data.csv'
  processCSV(CSV_FILE);