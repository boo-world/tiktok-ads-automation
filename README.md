# TikTok Ads Automation

This repository automates the creation of TikTok ads using videos, images, or TikTok One material IDs. It supports **creative refreshment** by uploading assets and creating new ads via CSV input.

---

## 📁 Project Structure

- `create-ads-video.js` — Create ads using video URLs.
- `create-ads-tiktokOne.js` — Create ads using TikTok One material IDs.
- `create-ads-images.js` — Create ads using image URLs.
- `test_video_data.csv`, `test_tiktok_one_data.csv`, `test_image_data.csv` — Sample CSV files for each type.

---

## 🚀 How to Use

### 1. Create TikTok Ads from Video URLs

#### Step 1: Prepare CSV
- Copy video URLs from this [Google Sheet](https://docs.google.com/spreadsheets/d/1dsDVu1m9g-AY2QYcIqXwc23nXqydkA50paTlMkaKQnM/edit?gid=1999308003).
- Format it as shown in `test_video_data.csv`.

#### Step 2: Run the Script
```bash
# Dry run (no uploads or ads)
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> node create-ads-video.js

# Test group only
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=YES node create-ads-video.js

# Real execution
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=NO node create-ads-video.js
```

---

### 2. Create TikTok Ads from TikTok One Material ID

#### Step 1: Prepare CSV
- Copy category, language, and material ID from this [Google Sheet](https://docs.google.com/spreadsheets/d/1dsDVu1m9g-AY2QYcIqXwc23nXqydkA50paTlMkaKQnM/edit?gid=1677798672).
- Format it as shown in `test_tiktok_one_data.csv`.

#### Step 2: Run the Script
```bash
# Dry run
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> node create-ads-tiktokOne.js

# Test group only
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=YES node create-ads-tiktokOne.js

# Real execution
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=NO node create-ads-tiktokOne.js
```

---

### 3. Create TikTok Ads from Image URLs

#### Step 1: Prepare CSV
- Copy image URLs from this [Google Sheet](https://docs.google.com/spreadsheets/d/1dsDVu1m9g-AY2QYcIqXwc23nXqydkA50paTlMkaKQnM/edit?gid=67247514).
- Format it as shown in `test_image_data.csv`.

#### Step 2: Run the Script
```bash
# Dry run
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> node create-ads-images.js

# Test group only
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=YES node create-ads-images.js

# Real execution
ACCESS_TOKEN=<your_token> ADVERTISER_ID=<your_id> DRYRUN=NO GROUP_TEST_ONLY=NO node create-ads-images.js
```

---

## ✅ Tips

- Always start with a **dry run** to avoid unintended uploads or ad creations.
- After execution, check the generated **reporting file** and **test ad group** for results or errors.
