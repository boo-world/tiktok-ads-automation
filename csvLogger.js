// csvLogger.js
const fs = require('fs');
const path = require('path');

class CsvLogger {
  constructor(filenamePrefix = 'report', reportDir = 'reports') {
    // Ensure reports directory exists
    this.reportDir = path.join(__dirname, reportDir);
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
    
    this.filename = this._generateTimestampedFilename(filenamePrefix);
    this.filePath = path.join(this.reportDir, this.filename);
    this.headers = 'File URL,file processed, create ad status, creative mode,Ad Group Name,Ad Group ID, Ad ID, video id,Error,Timestamp\n';
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

  log(videoUrl, entry) {
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

  getFilePath() {
    return this.filePath;
  }
}

module.exports = CsvLogger;