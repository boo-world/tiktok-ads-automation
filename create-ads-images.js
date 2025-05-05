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
const { sendBatch, searchAdGroupsByKeyword, getAdInfoFromAdGroup, prepareCreative, groupKeyword, getOriginalFilenameFromUrl } = require('./common')
const { DRYRUN, GROUP_TEST_ONLY, ADVERTISER_ID, TEST_GROUP } = require('./const')

const tiktokClient = new TikTokApiClient();

const CSV_FILE = process.env.CSV_FILE || 'test_image_data.csv'

async function uploadImage(fileName, buffer) {
    if(DRYRUN !== 'NO') return 'DRYRUN_IMAGE_ID'

    const signature = crypto.createHash('md5').update(buffer).digest('hex');
    const form = new FormData();
  
    form.append('advertiser_id', ADVERTISER_ID);
    form.append('file_name', fileName);
    form.append('image_file', buffer, { filename: fileName });
    form.append('image_signature', signature);
  
    const resp = await tiktokClient.request({
      path: '/open_api/v1.3/file/image/ad/upload/',
      method: 'POST',
      extraConfig: {
        headers: form.getHeaders(),
        data: form
      }
    });

    console.log('resp.data: ', resp.data)
  
    if (resp.data?.image_id) {
      return resp.data.image_id;
    } else {
      throw new Error(resp.message);
    }
  }

function parseImageUrls(raw) {
return raw.split('|').map(url => url.trim()).filter(Boolean);
}

async function processImageAds(rows) {
  const csvLogger = new CsvLogger('image_ad_processing_report', 'image');
  console.log('rows: ', rows)
  if (!rows.length) {
    console.log('No ads to process');
    return;
  }
  
  for (const row of rows) {
    let file_processed = 'FAILED'
    
    try {
        const imageUrls = parseImageUrls(row.image_url);
        const imageIds = [];
        let firstFilename
        for (let i = 0; i < imageUrls.length; i++) {
            const TIMESTAMP = Math.floor(Date.now() / 1000);
            const url = imageUrls[i];
            const { buffer, originalFilename } = await getOriginalFilenameFromUrl(url);
            console.log('filename:', originalFilename)
            if(i === 0){
                firstFilename = originalFilename
            }
            const imageId = await uploadImage(originalFilename.replace(/(\.[^/.]+)?$/, `-API_Upload-${TIMESTAMP}$1`),buffer);
            imageIds.push(imageId);
        }
        console.log('imageIds: ', imageIds)
        file_processed = 'SUCCESS'

        const adFormat = 'CAROUSEL_ADS' //always use CAROUSEL_ADS to avoid unsupported image size when using SINGLE_IMAGE
        const fileNameWithoutExt = firstFilename.replace(/\.[^/.]+$/, '');
        const adGroupKeyword = groupKeyword(fileNameWithoutExt)
        console.log('fileNameWithoutExt: ', fileNameWithoutExt)
        console.log('adGroupKeyword: ', adGroupKeyword)
        

        const adGroups = await searchAdGroupsByKeyword(adGroupKeyword, tiktokClient);
        if(adGroups.length == 0){
            const msg = `can not found any any groups with keyword: ${adGroupKeyword}`
            console.log(msg)
            csvLogger.logImage(row.image_url,
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
        if(DRYRUN === 'NO' && GROUP_TEST_ONLY === 'NO' && (group.adgroup_id === '1830897501983745' || group.adgroup_id === '1830897358117905')){
          csvLogger.logImage(row.image_url,
            {
              create_ad_status: 'NOT_APPLICABLE',
              adgroup_name: group.adgroup_name,
              adgroup_id: group.adgroup_id,
              error: 'skip test group'
            }
          )
          continue // skip test ad group
        }
        if(!/static\s+image/i.test(group.adgroup_name)){
          console.log(`skip ad group ${group.adgroup_name}`)
          csvLogger.logImage(row.image_url,
            {
              file_processed,
              create_ad_status: 'NOT_APPLICABLE',
              creative_material_mode: group.creative_material_mode,
              adgroup_name: group.adgroup_name,
              adgroup_id: group.adgroup_id,
              error: 'NOT_APPLICABLE for Non Static Image adGroup'
            }
          )
          continue // skip if ad group name has no "Static Image" words
        }

        
        console.log(`processing group ${group.adgroup_name} - ${group.adgroup_id}`)

        {
          const adInfo = await getAdInfoFromAdGroup(group.adgroup_id);
          const creative = await prepareCreative(
            { ...group, ad_name, format: adFormat },
            null,
            imageIds,
            adInfo
          );

          try {
            const res = await sendBatch(group, [creative.creative], tiktokClient);
            csvLogger.logImage(row.image_url,res)
          } catch (err) {
            console.error(`❌ Failed to create ad in group ${group.adgroup_id}:`, err.response?.data || err.message);
            csvLogger.logImage(row.image_url,{
              file_processed,
              create_ad_status: 'FAILED',
              creative_material_mode: group.creative_material_mode,
              adgroup_name: group.adgroup_name,
              adgroup_id: group.adgroup_id,
              image_id: imageIds,
              error: err.response?.data || err.message
            })
          }
        }
      }
    } catch (err) {
      csvLogger.logImage(row.image_url,{
        file_processed,
        error: err.response?.data || err.message
      })
      console.error(`❌ Failed processing image: ${row.image_url}`, err.response?.data || err.message);
    }
  }
}

function processCSV(path) {
  console.log('DRY RUN: ', DRYRUN)
  const rows = [];
  fs.createReadStream(path)
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      console.log(`📋 Loaded ${rows.length} rows from CSV`);
      await processImageAds(rows);
    });
}


processCSV(CSV_FILE);