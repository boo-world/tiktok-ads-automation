const TikTokApiClient = require('./TikTokApiClient');

const DRYRUN = process.env.DRYRUN || 'YES';

const tiktokClient = new TikTokApiClient();

function prepareAcoUpdatePayload({
  advertiserId,
  adgroupId,
  oldMediaInfoList,
  newVideoId,
  newVideoName,
  newWebUris
}) {
  if (!advertiserId || !adgroupId || !Array.isArray(oldMediaInfoList) || !newVideoId || !newVideoName || !newWebUris) {
    throw new Error("Missing required parameters");
  }

  const mediaInfoList = [
    ...oldMediaInfoList.map((oldEntry) => ({
      media_info: {
        video_info: { video_id: oldEntry.media_info?.video_info?.video_id, file_name: oldEntry.media_info?.video_info?.file_name },
        image_info: oldEntry.media_info?.image_info?.map((img) => ({
          web_uri: img.web_uri,
        })),
      },
    })),
    {
      media_info: {
        video_info: { video_id: newVideoId, file_name: newVideoName },
        image_info: [{ web_uri: newWebUris }],
      },
    },
  ];

  return {
    advertiser_id: advertiserId,
    adgroup_id: adgroupId,
    patch_update: true,
    media_info_list: mediaInfoList,
  };
}

function prepareAcoCreatePayload(params) {
  const {
    adgroupId,
    videoId,
    imageId,
    title,
    landingPageUrl,
    identityId,
    callToActionId,
    card_id,
  } = params;

  const payload = {};

  payload.advertiser_id = ADVERTISER_ID;

  if (adgroupId) {
    payload.adgroup_id = adgroupId;
  } else {
    throw new Error("adgroup_id is required");
  }

  if (videoId || imageId) {
    payload.media_info_list = [
      {
        media_info: {},
      },
    ];
    if (videoId) {
      payload.media_info_list[0].media_info.video_info = { video_id: videoId };
    }
    if (imageId) {
      payload.media_info_list[0].media_info.web_uri = [{ imageId: imageId }];
    }
  }

  if (title) {
    payload.title_list = [{ title }];
  }

  if (landingPageUrl) {
    payload.landing_page_urls = [{ landing_page_url: landingPageUrl }];
  }

  if (identityId || callToActionId) {
    payload.common_material = {
      identity_type: "CUSTOMIZED_USER",
      is_smart_creative: true,
    };
    if (identityId) payload.common_material.identity_id = identityId;
    if (callToActionId)
      payload.common_material.call_to_action_id = callToActionId;
  }

  if (card_id) {
    payload.card_list = [{ card_id }];
  }

  return payload;
}

async function getAdAcoDetail(advertiserId, adgroupId) {
  if (!advertiserId || !adgroupId) {
    throw new Error('advertiserId and adgroupId are required');
  }

  const response = await tiktokClient.request({
    method: 'GET',
    path: `/open_api/v1.3/ad/aco/get/?advertiser_id=${advertiserId}&adgroup_ids=["${adgroupId}"]`,
  });

  if (response.code !== 0) {
    throw response;
  }

  return response.data; 
}

async function updateAdACO({advertiserId, adgroupId, oldMediaInfoList, newVideoId, newVideoName, newWebUris}) {
    console.log('prepare update payload..')
    const payload = prepareAcoUpdatePayload({
        advertiserId,
        adgroupId,
        oldMediaInfoList,
        newVideoId,
        newVideoName,
        newWebUris
      })

      console.log('ACO payload: ', JSON.stringify(payload, null, 2))
      if(DRYRUN === 'NO'){
        try {
          const response = await tiktokClient.request({
            path: '/open_api/v1.3/ad/aco/update/',
            method: 'POST',
            payload
          });
          
          if (response.code !== 0) {
              console.log('resp: ', response)
              throw response;
            }
          
          return response.data; 
        } catch (err) {
          console.error('Failed to create ad:', err);
          throw err
        }
      }else{
        throw new Error('DRY RUN')
      }
}

module.exports = {prepareAcoUpdatePayload, prepareAcoCreatePayload, getAdAcoDetail, updateAdACO}