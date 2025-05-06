require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const crypto = require('crypto');
const FormData = require('form-data');
const path = require('path');
const CsvLogger = require('./csvLogger');
const TikTokApiClient = require('./TikTokApiClient');
const {updateAdACO, getAdAcoDetail} = require('./ACO')
const { getSuggestedCoverImageId, searchAdGroupsByKeyword, getAdInfoFromAdGroup, prepareCreative, groupKeyword, getOriginalFilenameFromUrl, sendBatch } = require('./common')
const { DRYRUN, GROUP_TEST_ONLY, ADVERTISER_ID } = require('./const')

const tiktokClient = new TikTokApiClient();

const CSV_FILE = process.env.CSV_FILE || 'test_data.csv'


async function uploadVideoOnce(fileNameWithTimestamp, buffer) {
  if(DRYRUN !== 'NO') return 'DRYRUN_VIDEO_ID'

  const signature = crypto.createHash('md5').update(buffer).digest('hex');
  const form = new FormData();

  form.append('advertiser_id', ADVERTISER_ID);
  form.append('file_name', fileNameWithTimestamp);
  form.append('video_file', buffer, { filename: fileNameWithTimestamp });
  form.append('video_signature', signature);

  const resp = await tiktokClient.request({
    path: '/open_api/v1.3/file/video/ad/upload/',
    method: 'POST',
    extraConfig: {
      headers: form.getHeaders(),
      data: form
    }
  });

  if (resp.data[0]?.video_id) {
    return resp.data[0].video_id;
  } else {
    throw new Error(resp.message);
  }
}

async function processAds(ads) {
  const csvLogger = new CsvLogger('ad_processing_report', 'video');
  
  if (!ads.length) {
    console.log('No ads to process');
    return;
  }

  // Extract unique video URLs
  const uniqueVideoUrls = [...new Set(ads.map(ad => ad.video_url))];
  for (const videoUrl of uniqueVideoUrls) {
    let file_processed = 'FAILED'

    try {
      console.log('download video...')
      const TIMESTAMP = Math.floor(Date.now() / 1000);
      const { buffer, originalFilename } = await getOriginalFilenameFromUrl(videoUrl);
      const fileNameWithTimestamp = originalFilename.replace(/(\.[^/.]+)?$/, `-API_Upload-${TIMESTAMP}$1`)
      const adGroupKeyword = groupKeyword(fileNameWithTimestamp)
      console.log('fileNameWithTimestamp: ', fileNameWithTimestamp)
      console.log('adGroupKeyword: ', adGroupKeyword)
      const videoId = await uploadVideoOnce(`${fileNameWithTimestamp}-API_Upload-${TIMESTAMP}`, buffer);
      await new Promise(res => setTimeout(res, 5000)); // wait for 3 seconds
      const imageId = await getSuggestedCoverImageId(`${videoId}`, tiktokClient);
      file_processed = 'SUCCESS'

      const adGroups = await searchAdGroupsByKeyword(adGroupKeyword, tiktokClient);
      if(adGroups.length == 0){
        const msg = `can not found any any groups with keyword: ${adGroupKeyword}`
        console.log(msg)
        csvLogger.logVideo(videoUrl,
          {
            file_processed,
            create_ad_status: 'FAILED',
            error: msg
          }
        )
        continue
      }
      console.log('adGroups: ', adGroups)
      for (const group of adGroups) {
        let ad_name = fileNameWithTimestamp
        if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO' && (group.adgroup_id === '1830096301782322' || group.adgroup_id === '1829719684525074')){
          csvLogger.logVideo(videoUrl,
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
          csvLogger.logVideo(videoUrl,
            {
              file_processed,
              create_ad_status: 'NOT_APPLICABLE',
              creative_material_mode: group.creative_material_mode,
              adgroup_name: group.adgroup_name,
              adgroup_id: group.adgroup_id,
              error: 'NOT_APPLICABLE for Static Image adGroup'
            }
          )
          continue // skip if ad group name has "Static Image" words
        }

        
        console.log(`processing group ${group.adgroup_name} - ${group.adgroup_id}`)

        if(group.creative_material_mode === 'SMART_CREATIVE'){
          let adAcoData
          try {
            adAcoData = await getAdAcoDetail(ADVERTISER_ID, group.adgroup_id);
          } catch (err) {
            console.error(`❌ Failed to get smart creative Ad Detail from group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.logVideo(videoUrl,{
              file_processed,
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
                newVideoName: fileNameWithTimestamp,
                newWebUris: imageId,
              });
              console.log(`✅ update smart creative on ad group ${group.adgroup_name} - ${group.adgroup_id}`);
              csvLogger.logVideo(videoUrl,{
                file_processed,
                create_ad_status: 'SUCCESS',
                creative_material_mode: group.creative_material_mode,
                adgroup_name: group.adgroup_name,
                adgroup_id: group.adgroup_id,
              })
          } catch (err) {
            console.error(`❌ Failed to Update smart creative Ad for group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.logVideo(videoUrl,{
              file_processed,
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
            csvLogger.logVideo(videoUrl,res)
          } catch (err) {
            console.error(`❌ Failed to create ad in group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.logVideo(videoUrl,{
              file_processed,
              create_ad_status: 'FAILED',
              creative_material_mode: group.creative_material_mode,
              adgroup_name: group.adgroup_name,
              adgroup_id: group.adgroup_id,
              video_id: videoId,
              error: err.response?.data || err.message
            })
          }
        }
      }
    } catch (err) {
      csvLogger.logVideo(videoUrl,{
        file_processed,
        error: err.response?.data || err.message
      })
      console.error(`❌ Failed processing video: ${videoUrl}`, err.response?.data || err.message);
    }
  }
}

function processCSV(path) {
  console.log('DRY RUN: ', DRYRUN)
  const ads = [];
  fs.createReadStream(path)
    .pipe(csv())
    .on('data', (row) => ads.push(row))
    .on('end', async () => {
      console.log(`📋 Loaded ${ads.length} rows from CSV`);
      await processAds(ads);
    });
}


processCSV(CSV_FILE);
// getSuggestedCoverImageId("v10033g50000d04hq7nog65pa4nv6890")
// searchAdGroupsByKeyword("General dating English")
// getAdInfoFromAdGroup("1826373779200033")
// console.log(getLandingPageURL('C. Philippines L. English || General Dating || App || Purchase || ios || Test Manual Ad Group || Manual Creative'))