// csvLogger.js
const fs = require('fs');
const path = require('path');

class CsvLogger {
  constructor(filenamePrefix = 'report', type = 'video', reportDir = 'reports') {
    // Ensure reports directory exists
    this.reportDir = path.join(__dirname, reportDir);
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    this.filename = this._generateTimestampedFilename(filenamePrefix);
    this.filePath = path.join(this.reportDir, this.filename);
    if(type === 'video'){
      this.headers = 'File URL,File processed,Create ad status,Creative mode,Ad Group Name,Ad Group ID, Ad ID,Video id,Error,Timestamp\n';
    }else if(type === 'retry-video'){
      this.headers = 'Ad Group ID, Video id,Create ad status,Creative mode,Ad Group Name, Ad ID,Error,Timestamp\n';
    }
    else if(type === 'tiktok-one'){
      this.headers = 'Category,Language, Material ID,Create ad status,Creative mode,Ad Group Name, Ad Group ID, Ad ID, Video id,Error,Timestamp\n';
    }else if(type === 'image'){
      this.headers = 'File URLs,File processed,Create ad status,Creative mode,Ad Group Name,Ad Group ID, Ad ID,Images IDs,Error,Timestamp\n';
    }

    this._initializeFile();
  }

  _generateTimestampedFilename(prefix) {
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('-');
    return `${prefix}_${dateStr}_${timeStr}.csv`;
  }

  _initializeFile() {
    fs.writeFileSync(this.filePath, this.headers);
    console.log(`Logging to: ${this.filePath}`);
  }

  logVideo(videoUrl, entry) {
    const timestamp = new Date().toISOString();
    const row = [
      `"${videoUrl}"`,
      `"${entry.file_processed || ''}"`,
      `"${entry.create_ad_status || ''}"`,
      `"${entry.creative_material_mode || ''}"`,
      `"${entry.adgroup_name || ''}"`,
      `"${entry.adgroup_id || ''}"`,
      `"${entry.ad_id || ''}"`,
      `"${entry.video_id || ''}"`,
      `"${(entry.error || '').toString().replace(/"/g, '""')}"`,
      `"${timestamp}"`
    ].join(',');

    fs.appendFileSync(this.filePath, row + '\n');
  }

  logImage(imageUrl, entry) {
    const timestamp = new Date().toISOString();
    const row = [
      `"${imageUrl}"`,
      `"${entry.file_processed || ''}"`,
      `"${entry.create_ad_status || ''}"`,
      `"${entry.creative_material_mode || ''}"`,
      `"${entry.adgroup_name || ''}"`,
      `"${entry.adgroup_id || ''}"`,
      `"${entry.ad_id || ''}"`,
      `"${entry.image_id || ''}"`,
      `"${(entry.error || '').toString().replace(/"/g, '""')}"`,
      `"${timestamp}"`
    ].join(',');

    fs.appendFileSync(this.filePath, row + '\n');
  }

  logRetryVideo(adgroup_id, video_id, entry) {
    const timestamp = new Date().toISOString();
    const row = [
      `"${adgroup_id}"`,
      `"${video_id}"`,
      `"${entry.create_ad_status || ''}"`,
      `"${entry.creative_material_mode || ''}"`,
      `"${entry.adgroup_name || ''}"`,
      `"${entry.ad_id || ''}"`,
      `"${(entry.error || '').toString().replace(/"/g, '""')}"`,
      `"${timestamp}"`
    ].join(',');

    fs.appendFileSync(this.filePath, row + '\n');
  }

  logTiktokOneVideo(category,language,material_id, entry) {
    const timestamp = new Date().toISOString();
    const row = [
      `"${category}"`,
      `"${language}"`,
      `"${material_id}"`,
      `"${entry.create_ad_status || ''}"`,
      `"${entry.creative_material_mode || ''}"`,
      `"${entry.adgroup_name || ''}"`,
      `"${entry.adgroup_id || ''}"`,
      `"${entry.ad_id || ''}"`,
      `"${entry.video_id || ''}"`,
      `"${(entry.error || '').toString().replace(/"/g, '""')}"`,
      `"${timestamp}"`
    ].join(',');

    fs.appendFileSync(this.filePath, row + '\n');
  }

  getFilePath() {
    return this.filePath;
  }
}

module.exports = CsvLogger;