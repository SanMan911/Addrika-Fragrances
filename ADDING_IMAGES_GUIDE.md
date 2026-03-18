# Complete Guide: Adding Your Brand Assets to Addrika Website

## 🎯 Overview

This guide will help you add your brand logos and product images to your Addrika website.

---

## 📸 What Images You Need

### 1. **Addrika Brand Logo**
- **Where it appears:** Header (top navigation) & Footer
- **Format:** PNG with transparent background preferred
- **Recommended size:** 200-400px width, maintain aspect ratio
- **File name:** `addrika-logo.png`
- **File size:** Keep under 100 KB

### 2. **Company Logo (Optional)**
- **Where it appears:** Footer or About section
- **Format:** PNG with transparent background
- **Recommended size:** 150-300px width
- **File name:** `company-logo.png`
- **File size:** Keep under 100 KB

### 3. **Product Photos** (4 images needed)
- **Kesar Chandan** fragrance photo
- **Regal Rose** fragrance photo  
- **Oriental Oudh** fragrance photo
- **Bold Bakhoor** fragrance photo

**Requirements for each:**
- **Format:** JPG or PNG
- **Size:** 800-1200px width (landscape orientation)
- **Aspect ratio:** 16:9 or 4:3 works best
- **File size:** 200-500 KB each (compress if larger)
- **File names:**
  - `kesar-chandan.jpg`
  - `regal-rose.jpg`
  - `oriental-oudh.jpg`
  - `bold-bakhoor.jpg`

---

## 📁 Where to Place Your Images

Your images go in these folders:

```
/app/frontend/public/images/
├── logos/
│   └── addrika-logo.png          ← Your Addrika logo here
│
└── products/
    ├── kesar-chandan.jpg          ← Product photo 1
    ├── regal-rose.jpg              ← Product photo 2
    ├── oriental-oudh.jpg           ← Product photo 3
    └── bold-bakhoor.jpg            ← Product photo 4
```

---

## 🚀 How to Upload Images

### **Option 1: Upload via Emergent File Manager** (Easiest)

1. **In your Emergent dashboard:**
   - Look for "Files" or "File Manager" option
   - Navigate to `/app/frontend/public/images/`

2. **Upload logos:**
   - Go to `images/logos/` folder
   - Click "Upload" button
   - Select your `addrika-logo.png`
   - Upload

3. **Upload product photos:**
   - Go to `images/products/` folder
   - Click "Upload" button
   - Select all 4 product photos
   - Upload

---

### **Option 2: Via Git/GitHub** (If connected)

1. Clone your repository locally
2. Add images to the correct folders
3. Commit and push:
   ```bash
   git add frontend/public/images/
   git commit -m "Add brand logos and product images"
   git push
   ```

---

### **Option 3: Ask Me to Upload** (Easy Alternative)

**If you can provide me with:**
1. Direct download links to your images (Google Drive, Dropbox, etc.)
2. Or describe where they're stored

**I can help you add them directly!**

---

## 🖼️ Image Optimization Tips

**Before uploading, optimize your images:**

### **For Logos:**
1. Use PNG format with transparent background
2. Remove unnecessary whitespace around logo
3. Compress using: https://tinypng.com
4. Target file size: Under 100 KB

### **For Product Photos:**
1. Crop to show product clearly
2. Use consistent background (white/neutral preferred)
3. Ensure good lighting and focus
4. Compress using: https://squoosh.app or https://tinypng.com
5. Target file size: 200-500 KB each

---

## ✅ After Uploading Images

Once you've uploaded your images, you need to restart the frontend:

**Option A: Via Emergent Dashboard**
- Find "Restart" or "Redeploy" button
- Click it to apply changes

**Option B: Via Command** (if you have access)
```bash
sudo supervisorctl restart frontend
```

**Wait 1-2 minutes**, then refresh your website!

---

## 🔍 Verification Checklist

After images are added, check:

**Header:**
- [ ] Addrika logo appears in top left
- [ ] Logo is clear and properly sized
- [ ] Logo works on both desktop and mobile

**Product Section:**
- [ ] All 4 product images display correctly
- [ ] Images maintain good quality
- [ ] Images load quickly (not too large)
- [ ] Images show products clearly

**Footer:**
- [ ] Logo appears (if using logo in footer)
- [ ] Company information displays correctly

**Performance:**
- [ ] Website loads in under 3 seconds
- [ ] Images don't slow down the page
- [ ] Mobile experience is smooth

---

## 🎨 Current Fallback Behavior

**Good news:** Your website has smart fallbacks!

**If logo image is missing:**
- Website shows "Addrika" text instead
- Website still works perfectly
- No broken image icons

**If product images are missing:**
- Placeholder images from Unsplash display
- Everything still functions normally

**This means:**
- ✅ Your website works NOW with placeholders
- ✅ You can add images whenever ready
- ✅ No rush - test the site first!

---

## 📝 File Naming Rules

**IMPORTANT:** Use exact filenames as specified!

**Logos:**
```
✅ CORRECT: addrika-logo.png
❌ WRONG: Addrika Logo.png
❌ WRONG: addrika_logo.PNG
❌ WRONG: logo.png
```

**Products:**
```
✅ CORRECT: kesar-chandan.jpg
❌ WRONG: Kesar Chandan.jpg
❌ WRONG: kesar_chandan.jpeg
❌ WRONG: product1.jpg
```

**Why this matters:**
- Linux servers are case-sensitive
- Spaces in filenames cause issues
- Code expects exact names

---

## 🆘 Troubleshooting

### **Problem: Logo doesn't appear**

**Check:**
1. Filename is exactly `addrika-logo.png` (lowercase, hyphen, .png)
2. File is in `/app/frontend/public/images/logos/` folder
3. File size is under 1 MB
4. File is actually a PNG image
5. Frontend has been restarted

**Solution:**
```bash
# Check if file exists
ls -lh /app/frontend/public/images/logos/addrika-logo.png

# Restart frontend
sudo supervisorctl restart frontend
```

### **Problem: Product images don't show**

**Check:**
1. All 4 filenames match exactly
2. Files are in `/app/frontend/public/images/products/` folder
3. Files are JPG or PNG format
4. File sizes are reasonable (under 2 MB each)

**Solution:**
```bash
# List all product images
ls -lh /app/frontend/public/images/products/

# Should show all 4 files
```

### **Problem: Images load slowly**

**Solution:**
- Compress images more aggressively
- Target: Logos under 100 KB, Products under 500 KB
- Use tools: TinyPNG, Squoosh, ImageOptim

---

## 💡 Pro Tips

1. **Keep backups:** Save original high-quality images separately
2. **Test on mobile:** Check how images look on phones
3. **Consistent style:** Use similar photo styles for all products
4. **Update easily:** Images in `/public/` can be replaced anytime
5. **Version control:** If using Git, commit images separately

---

## 📞 Need Help?

**If you need assistance:**

1. **Share your images with me:**
   - Upload to Google Drive/Dropbox
   - Share the link
   - I can help optimize and add them

2. **Can't access file system?**
   - Tell me and I'll find alternative upload method
   - Emergent support can also help

3. **Not sure about image quality?**
   - Share samples
   - I'll advise on optimization

---

## 🎉 Quick Start

**Want to see your logo quickly?**

1. Save this to your computer: `/app/frontend/public/images/logos/addrika-logo.png`
2. Upload via Emergent file manager
3. Restart frontend
4. Refresh centraders.com
5. See your logo in header!

**That's it!** Your brand is now live on the website! 🚀

---

## 📚 Additional Resources

**Free image optimization tools:**
- https://tinypng.com (for logos)
- https://squoosh.app (for photos)
- https://compressor.io (batch compression)

**Stock images (if needed temporarily):**
- https://unsplash.com
- https://pexels.com
- https://pixabay.com

**Logo creation (if needed):**
- Canva.com (easy logo maker)
- Fiverr.com (hire designer)
- 99designs.com (logo contests)

---

**Questions? Just ask! I'm here to help you get your brand looking perfect on your website.** ✨
