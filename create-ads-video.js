require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const csv = require('csv-parser');
const crypto = require('crypto');
const FormData = require('form-data');
const path = require('path');
const JSONbig = require('json-bigint');
const CsvLogger = require('./csvLogger');
const TikTokApiClient = require('./TikTokApiClient');
const {updateAdACO, getAdAcoDetail} = require('./ACO')

const tiktokClient = new TikTokApiClient();

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const ADVERTISER_ID = process.env.ADVERTISER_ID;
const DRYRUN = process.env.DRYRUN || 'YES';
const GROUP_TEST_ONLY = process.env.GROUP_TEST_ONLY || 'YES';
const TIKTOK_BASE_URL = 'https://business-api.tiktok.com'
const CSV_FILE = process.env.CSV_FILE || 'test_data.csv'

HEADERS = {
  'Access-Token': ACCESS_TOKEN,
  'Content-Type': 'application/json'
}

function getDirectDownloadUrl(driveUrl) {
  const match = driveUrl.match(/\/file\/d\/([^/]+)\//);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return driveUrl;
}

async function getOriginalFilenameFromUrl(url) {
  if(DRYRUN !== 'NO') return  { buffer: {}, originalFilename:'DRYRUN_FILENAME'};

  const directUrl = getDirectDownloadUrl(url);
  const response = await axios.get(directUrl, { responseType: 'arraybuffer' });

  let originalFilename;
  const contentDisposition = response.headers['content-disposition'];
  const match = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (match) {
    originalFilename = match[1].replace(/['"]/g, '');
  } else {
    try {
      const urlFilename = decodeURIComponent(url.split('/').pop().split('?')[0]);
      originalFilename = urlFilename;
    } catch {
      throw new Error("can't get video filename");
    }
  }

  return { buffer: response.data, originalFilename };
}

async function uploadVideoOnce(fileNameWithoutExt, buffer) {
  if(DRYRUN !== 'NO') return 'DRYRUN_VIDEO_ID'

  const signature = crypto.createHash('md5').update(buffer).digest('hex');
  const form = new FormData();

  form.append('advertiser_id', ADVERTISER_ID);
  form.append('file_name', fileNameWithoutExt);
  form.append('video_file', buffer, { filename: `${fileNameWithoutExt}.mp4` });
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

async function getSuggestedCoverImageId(videoId) {
  if(DRYRUN !== 'NO') return 'DRYRUN_COVER_IMAGE_ID'

  console.log('get suggested cover image for video id: ', videoId)

  const path = '/open_api/v1.3/file/video/suggestcover/';
  const payload = {
    advertiser_id: ADVERTISER_ID,
    video_id: videoId
  };

  const resp = await tiktokClient.request({
    path,
    method: 'GET',
    payload
  });
  
  const suggestions = resp?.data?.list;
  if (!suggestions || suggestions.length === 0) {
    throw new Error('No cover image suggestions returned.');
  }
  console.log('suggested: ', suggestions[0].id)
  return suggestions[0].id;
}

async function searchAdGroupsByKeyword(keyword) {
  if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO'){
    const path = '/open_api/v1.3/adgroup/get/';
    const payload = {
      advertiser_id: ADVERTISER_ID,
      page_size: 1000,
      page: 1,
      filtering: JSON.stringify({ adgroup_name: keyword }),
      fields: JSON.stringify(["adgroup_id", "adgroup_name", "creative_material_mode"])
    };

    const resp = await tiktokClient.request({
      path,
      method: 'GET',
      payload
    });
    console.log('actual found group counts: ', resp.data?.list.length)
    console.log('actual found group: ', resp.data?.list)

    return resp.data?.list || [];
  }else{
    return [
      {
          "adgroup_name": "C. Philippines L. English || General Dating || App || Purchase || Android || Test Manual Ad Group || Manual Creative",
          "creative_material_mode": "CUSTOM",
          "adgroup_id": "1830096301782322"
      },
      {
          "adgroup_name": "Philippines L. English || General Dating || App || Purchase || Android || Test Ad Group || Smart Creative",
          "creative_material_mode": "SMART_CREATIVE",
          "adgroup_id": "1829719684525074"
      },
    ]
  }
}

async function getAdInfoFromAdGroup(adgroupId) {

  const url = `${TIKTOK_BASE_URL}/open_api/v1.3/ad/get/?advertiser_id=${ADVERTISER_ID}&page_size=1&page=1&filtering=${encodeURIComponent(JSON.stringify({ adgroup_ids: [adgroupId] }))}`;
  const resp = await axios.get(url, {
    headers: HEADERS,
    transformResponse: [data => {
      // Use JSONbig to parse the original string response
      const parsed = JSONbig({ storeAsString: true }).parse(data);
      return parsed;
    }]
  });

  console.log('sibling ads: ', resp.data.data?.list)

  const firstAd = resp.data.data?.list?.[0];
  return {
    ad_text: firstAd?.ad_text || 'Try Boo Now!',
    identity_type: firstAd?.identity_type || 'CUSTOMIZED_USER',
    identity_id: firstAd?.identity_id || '7465983795406553096',
    tracking_app_id: firstAd?.tracking_app_id,
    cpp_url: firstAd?.cpp_url,
    call_to_action_id: firstAd?.call_to_action_id,
    app_name: firstAd?.app_name,
    card_id: firstAd?.card_id,
    page_id: firstAd?.page_id,
    ad_format: firstAd?.ad_format,
    landing_page_urls: firstAd.landing_page_urls
  };
}




async function prepareCreative(ad, videoId, imageId, adInfo) {
  const creative = {
    ad_name: ad.ad_name,
    identity_type: adInfo.identity_type,
    identity_id: adInfo.identity_id,
    ad_format: 'SINGLE_VIDEO',
    ad_text: adInfo.ad_text,
    call_to_action: 'DOWNLOAD_NOW',
    video_id: videoId,
    image_ids: [imageId],
  };

  if (ad.adgroup_name.toLowerCase().includes(' || android || ')) {
    creative.landing_page_url = 'https://play.google.com/store/apps/details?id=enterprises.dating.boo'
  } else if (ad.adgroup_name.toLowerCase().includes(' || ios || ')) {
    if (ad.adgroup_name.toLowerCase().includes(' || general dating || ')){
      creative.landing_page_url = 'https://apps.apple.com/us/app/boo-personality-dating-app/id1498407272'
    }else if (ad.adgroup_name.toLowerCase().includes(' || gaming || ')){
      creative.cpp_url = 'https://apps.apple.com/us/app/boo-dating-friends-chat/id1498407272?ppid=54875da2-aa8c-4453-b8ae-7c77bc313c0e'
    }else if (ad.adgroup_name.toLowerCase().includes(' || anime || ')){
      creative.cpp_url = 'https://apps.apple.com/us/app/boo-dating-friends-chat/id1498407272?ppid=47b17bcd-18a8-4061-8cc1-f516a37ee245'
    }
  }

  if (adInfo.tracking_app_id) {
    creative.tracking_app_id = adInfo.tracking_app_id;
  }

  if (adInfo.call_to_action_id) {
    creative.call_to_action_id = adInfo.call_to_action_id;
  }

  if (adInfo.app_name) {
    creative.app_name = adInfo.app_name;
  }

  if (adInfo.card_id) {
    creative.card_id = adInfo.card_id;
  }

  if (adInfo.page_id) {
    creative.page_id = adInfo.page_id;
  }
  return {
    adgroup_id: ad.adgroup_id,
    creative,
  };
}

async function sendBatch(group, creativeBatch) {
  const payload = {
    advertiser_id: ADVERTISER_ID,
    adgroup_id: group.adgroup_id,
    creatives: creativeBatch,
  };

  console.log('payload: ', payload)
  
  if(DRYRUN !== 'NO') return {
    file_processed: 'SUCCESS',
    create_ad_status: 'FAILED',
    creative_material_mode: group.creative_material_mode,
    adgroup_name: group.adgroup_name,
    adgroup_id: group.adgroup_id,
    error: 'DRY RUN'
  }

  
  try {

    const resp = await tiktokClient.request({
      path: '/open_api/v1.3/ad/create/',
      method: 'POST',
      payload
    });

    if(resp.data?.ad_ids?.length > 0){
      console.log(`✅ Created ad on ad group ${group.adgroup_name} - ${group.adgroup_id}: ${resp.data.ad_ids}`);
      return {
        file_processed: 'SUCCESS',
        create_ad_status: 'SUCCESS',
        creative_material_mode: group.creative_material_mode,
        adgroup_name: group.adgroup_name,
        adgroup_id: group.adgroup_id,
        ad_id: resp.data.ad_ids[0]
      }
    }else{
      console.log(`❌ failed created ad on group ${group.adgroup_name} - ${group.adgroup_id}: ${resp.message}`);
      return {
        file_processed: 'SUCCESS',
        create_ad_status: 'FAILED',
        creative_material_mode: group.creative_material_mode,
        adgroup_name: group.adgroup_name,
        adgroup_id: group.adgroup_id,
        video_id: creativeBatch[0].video_id,
        error: resp.message
      }
    }
  } catch (err) {
    throw err
  }
}

async function processAds(ads) {
  const csvLogger = new CsvLogger('ad_processing_report');
  
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
      const { buffer, originalFilename } = await getOriginalFilenameFromUrl(videoUrl);
      const fileNameWithoutExt = originalFilename.replace(/\.mp4$/i, '');
      const adGroupKeyword = fileNameWithoutExt.split('_').slice(0, 2).join(' ');
      console.log('fileNameWithoutExt: ', fileNameWithoutExt)
      console.log('adGroupKeyword: ', adGroupKeyword)
      const TIMESTAMP = Math.floor(Date.now() / 1000);
      const videoId = await uploadVideoOnce(`${fileNameWithoutExt}-API_Upload-${TIMESTAMP}`, buffer);
      await new Promise(res => setTimeout(res, 5000)); // wait for 3 seconds
      const imageId = await getSuggestedCoverImageId(`${videoId}`);
      file_processed = 'SUCCESS'
      
      

      const adGroups = await searchAdGroupsByKeyword(adGroupKeyword);
      if(adGroups.length == 0){
        const msg = `can not found any any groups with keyword: ${adGroupKeyword}`
        console.log(msg)
        csvLogger.log(videoUrl,
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
        let ad_name = fileNameWithoutExt
        if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO' && (group.adgroup_id === '1830096301782322' || group.adgroup_id === '1829719684525074')){
          csvLogger.log(videoUrl,
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
          csvLogger.log(videoUrl,
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
            csvLogger.log(videoUrl,{
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
                newVideoName: originalFilename,
                newWebUris: imageId,
              });
              console.log(`✅ update smart creative on ad group ${group.adgroup_name} - ${group.adgroup_id}`);
              csvLogger.log(videoUrl,{
                file_processed,
                create_ad_status: 'SUCCESS',
                creative_material_mode: group.creative_material_mode,
                adgroup_name: group.adgroup_name,
                adgroup_id: group.adgroup_id,
              })
          } catch (err) {
            console.error(`❌ Failed to Update smart creative Ad for group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.log(videoUrl,{
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
            { ...group, ad_name },
            videoId,
            imageId,
            adInfo
          );

          try {
            const res = await sendBatch(group, [creative.creative]);
            csvLogger.log(videoUrl,res)
          } catch (err) {
            console.error(`❌ Failed to create ad in group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.log(videoUrl,{
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
      csvLogger.log(videoUrl,{
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