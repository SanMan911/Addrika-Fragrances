# Simple Image Upload Guide - DIY Method

## 🎯 How to Upload Images to Your Website Yourself

This guide shows you the **exact code and steps** to upload images to your Addrika website without needing assistance.

---

## 📁 Method 1: Using Command Line (Easiest if you have terminal access)

### **Step 1: Upload Image from URL**

If your image is accessible via a URL (like from Google Drive, Dropbox, or direct link):

```bash
# Download and place logo
wget -O /app/frontend/public/images/logos/addrika-logo.png "YOUR_IMAGE_URL_HERE"

# Download and place product image
wget -O /app/frontend/public/images/products/kesar-chandan.jpg "YOUR_IMAGE_URL_HERE"
```

### **Step 2: Verify Upload**

```bash
# Check logo was uploaded
ls -lh /app/frontend/public/images/logos/

# Check product images
ls -lh /app/frontend/public/images/products/
```

### **Step 3: Restart Frontend**

```bash
sudo supervisorctl restart frontend
```

### **Step 4: Wait and Refresh**

- Wait 10-15 seconds for compilation
- Hard refresh your browser: `Ctrl + Shift + R` or `Cmd + Shift + R`

---

## 📋 Complete Command Template

**Copy and paste this template, replace YOUR_IMAGE_URL with actual URLs:**

```bash
# ========================================
# ADDRIKA IMAGE UPLOAD SCRIPT
# ========================================

# 1. Upload Logo
wget -O /app/frontend/public/images/logos/addrika-logo.png "YOUR_LOGO_URL"

# 2. Upload Product Images
wget -O /app/frontend/public/images/products/kesar-chandan.jpg "YOUR_KESAR_CHANDAN_URL"
wget -O /app/frontend/public/images/products/regal-rose.jpg "YOUR_REGAL_ROSE_URL"
wget -O /app/frontend/public/images/products/oriental-oudh.jpg "YOUR_ORIENTAL_OUDH_URL"
wget -O /app/frontend/public/images/products/bold-bakhoor.jpg "YOUR_BOLD_BAKHOOR_URL"

# 3. Verify uploads
echo "=== Checking uploaded files ==="
ls -lh /app/frontend/public/images/logos/
ls -lh /app/frontend/public/images/products/

# 4. Restart frontend
sudo supervisorctl restart frontend

echo "✅ Images uploaded! Wait 15 seconds, then refresh your browser."
```

---

## 🔗 Method 2: Get Direct URLs from Cloud Storage

### **Google Drive:**

1. Upload image to Google Drive
2. Right-click → "Get link"
3. Change to "Anyone with the link"
4. **Important:** Convert the link format:

**Original Google Drive link:**
```
https://drive.google.com/file/d/1abc123xyz/view
```

**Convert to direct download link:**
```
https://drive.google.com/uc?export=download&id=1abc123xyz
```

**Use this converted link in the wget command!**

### **Dropbox:**

1. Upload to Dropbox
2. Get shareable link
3. Change `?dl=0` to `?dl=1` at the end

**Example:**
```
Original: https://www.dropbox.com/s/abc123/image.png?dl=0
Use this: https://www.dropbox.com/s/abc123/image.png?dl=1
```

---

## 📂 Method 3: Upload via VS Code File System

### **Step 1: Prepare Your Image**

- Save image on your computer
- Name it exactly: `addrika-logo.png` or `kesar-chandan.jpg` (exact names matter!)

### **Step 2: Access Terminal in VS Code**

1. Open VS Code
2. Click **Terminal** → **New Terminal** (or press Ctrl+`)
3. You'll see a command line at the bottom

### **Step 3: Upload Using Terminal**

If you have the file on your local computer and can access it via path:

```bash
# If file is in your Downloads folder (example)
cp ~/Downloads/addrika-logo.png /app/frontend/public/images/logos/

# Restart frontend
sudo supervisorctl restart frontend
```

---

## 🖼️ Current File Structure

```
/app/frontend/public/images/
├── logos/
│   └── addrika-logo.png          ← Your logo goes here (30KB, perfect!)
│
└── products/
    ├── kesar-chandan.jpg          ← Product photo 1 (need to upload)
    ├── regal-rose.jpg              ← Product photo 2 (need to upload)
    ├── oriental-oudh.jpg           ← Product photo 3 (need to upload)
    └── bold-bakhoor.jpg            ← Product photo 4 (need to upload)
```

---

## ✅ Verification Commands

**Check if your images are uploaded:**

```bash
# Check logo
ls -lh /app/frontend/public/images/logos/addrika-logo.png

# Check all product images
ls -lh /app/frontend/public/images/products/

# Check file sizes (should be 50KB-500KB each)
du -h /app/frontend/public/images/logos/*
du -h /app/frontend/public/images/products/*
```

---

## 🔄 Restart Commands

**After uploading ANY image, always restart:**

```bash
# Restart only frontend (faster)
sudo supervisorctl restart frontend

# OR restart everything (if needed)
sudo supervisorctl restart all

# Check status
sudo supervisorctl status
```

---

## 📸 Image Requirements Summary

### **Logo:**
- **Filename:** `addrika-logo.png` (exact name!)
- **Size:** 30KB (your current logo is perfect!)
- **Format:** PNG with transparent or light background
- **Location:** `/app/frontend/public/images/logos/`

### **Product Photos:**
- **Filenames:** Must be exact:
  - `kesar-chandan.jpg`
  - `regal-rose.jpg`
  - `oriental-oudh.jpg`
  - `bold-bakhoor.jpg`
- **Size:** 200-500KB each (recommended)
- **Format:** JPG or PNG
- **Location:** `/app/frontend/public/images/products/`

---

## 🚨 Common Issues and Solutions

### **Issue 1: Image doesn't appear after upload**

**Solution:**
```bash
# Clear cache and restart
sudo supervisorctl restart frontend
# Wait 15 seconds
# Hard refresh browser: Ctrl+Shift+R
```

### **Issue 2: "File not found" error**

**Causes:**
- Wrong filename (case-sensitive!)
- Wrong folder location
- Typo in filename

**Check:**
```bash
# List exactly what's in the folder
ls -la /app/frontend/public/images/logos/
ls -la /app/frontend/public/images/products/
```

### **Issue 3: Image URL not working**

**Solution:**
- Test URL in browser first
- Make sure it's a direct image link (ends in .png, .jpg)
- Convert Google Drive links to direct download format
- Use Dropbox links with `?dl=1`

### **Issue 4: Permission denied**

**Solution:**
```bash
# Give proper permissions
sudo chmod 644 /app/frontend/public/images/logos/addrika-logo.png
sudo chmod 644 /app/frontend/public/images/products/*.jpg
```

---

## 🎯 Quick Reference: Upload 1 Image

**Complete workflow for uploading ONE image:**

```bash
# 1. Download image
wget -O /app/frontend/public/images/logos/addrika-logo.png "YOUR_URL"

# 2. Verify it's there
ls -lh /app/frontend/public/images/logos/addrika-logo.png

# 3. Restart
sudo supervisorctl restart frontend

# 4. Wait 15 seconds

# 5. Check compilation
tail -n 5 /var/log/supervisor/frontend.out.log

# 6. Refresh browser (Ctrl+Shift+R)
```

**Done! Your image should appear.**

---

## 📝 Real Example

**Actual command I used to upload your logo:**

```bash
wget -O /app/frontend/public/images/logos/addrika-logo.png "https://customer-assets.emergentagent.com/job_fragrant-incense/artifacts/wjic3w87_Addrika%20Original.png"

sudo supervisorctl restart frontend
```

**That's it!** 2 commands, done in 30 seconds.

---

## 💡 Pro Tips

1. **Always use exact filenames** (case-sensitive)
2. **Optimize images before upload** (use TinyPNG.com)
3. **Test URL in browser** before using in wget
4. **Wait 15 seconds** after restart before checking
5. **Use hard refresh** to clear browser cache
6. **Keep backups** of original images on your computer

---

## 🆘 If You Get Stuck

**Share with me:**
1. The exact command you ran
2. Any error messages you see
3. Output of: `ls -lh /app/frontend/public/images/logos/`

**I'll help troubleshoot!**

---

## ✅ Current Status

**✓ Logo uploaded:** addrika-logo.png (30KB)
**✓ Location:** `/app/frontend/public/images/logos/`
**✓ Frontend:** Restarted and compiled
**✓ Website:** Live at https://centraders.com

**Next:** Upload 4 product photos using the same method!

---

**Save this guide for future uploads!** 📚
