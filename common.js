const axios = require('axios');
const { DRYRUN, TIKTOK_BASE_URL, ADVERTISER_ID, ACCESS_TOKEN, GROUP_TEST_ONLY } = require('./const')
const JSONbig = require('json-bigint');

function groupKeyword(fileNameWithoutExt) {
  return fileNameWithoutExt.split('_').slice(0, 2).join(' ');
}

async function getSuggestedCoverImageId(videoId, tiktokClient) {
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

async function getAdInfoFromAdGroup(adgroupId) {

    const url = `${TIKTOK_BASE_URL}/open_api/v1.3/ad/get/?advertiser_id=${ADVERTISER_ID}&page_size=1&page=1&filtering=${encodeURIComponent(JSON.stringify({ adgroup_ids: [adgroupId] }))}`;
    const resp = await axios.get(url, {
      headers: {
        'Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
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

  async function getVideoInfo(video_id, tiktokClient) {
    try{
      const path = '/open_api/v1.3//file/video/ad/info/';
      const payload = {
        advertiser_id: ADVERTISER_ID,
        video_ids: JSON.stringify([video_id])
      };
  
      const resp = await tiktokClient.request({
        path,
        method: 'GET',
        payload
      });
    
      if (resp.code !== 0) {
        console.log('resp: ', resp)
        throw resp;
      }
     return resp.data.list[0]; 
  } catch (err) {
    console.error('Failed to get video info', err);
    throw err
  }
  
  }

  async function searchAdGroupsById(adgroupId, tiktokClient) {

    try {
      if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO'){
        const path = '/open_api/v1.3/adgroup/get/';
        const payload = {
          advertiser_id: ADVERTISER_ID,
          page_size: 1000,
          page: 1,
          filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
          fields: JSON.stringify(["adgroup_id", "adgroup_name", "creative_material_mode"])
        };
    
        const resp = await tiktokClient.request({
          path,
          method: 'GET',
          payload
        });
        console.log('actual found group: ', resp.data?.list)
        if (resp.code !== 0) {
          console.log('resp: ', resp)
          throw resp;
        }
        return resp.data?.list?.[0];
      }else{
        return {
              "adgroup_name": "C. Philippines L. English || General Dating || App || Purchase || Android || Test Manual Ad Group || Manual Creative",
              "creative_material_mode": "CUSTOM",
              "adgroup_id": "1830096301782322"
          }
      }
    } catch (error) {
      console.error('Failed to get Ad group info', err);
      throw err
    }
    
  }

  async function searchAdGroupsByKeyword(keyword, tiktokClient) {
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

  async function prepareCreative(ad, videoId, imageId, adInfo) {
    const creative = {
      ad_name: ad.ad_name,
      identity_type: adInfo.identity_type,
      identity_id: adInfo.identity_id,
      ad_format: ad.format,
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

  async function getOriginalFilenameFromUrl(url) {
    if(DRYRUN !== 'NO') return  { buffer: {}, originalFilename:'DRYRUN_FILENAME'};
  
    const directUrl = _getDirectDownloadUrl(url);
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
        throw new Error("can't get file name");
      }
    }
  
    return { buffer: response.data, originalFilename };
  }

  function _getDirectDownloadUrl(driveUrl) {
    const match = driveUrl.match(/\/file\/d\/([^/]+)\//);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return driveUrl;
  }

  async function sendBatch(group, creativeBatch, tiktokClient) {
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

module.exports = {getSuggestedCoverImageId, getAdInfoFromAdGroup, searchAdGroupsByKeyword, searchAdGroupsById, prepareCreative, groupKeyword, getOriginalFilenameFromUrl, getVideoInfo, sendBatch}