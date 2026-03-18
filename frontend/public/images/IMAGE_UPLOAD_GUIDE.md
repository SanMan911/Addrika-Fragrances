# Image Upload Guide for Addrika Website

## 📁 Folder Structure

```
/app/frontend/public/images/
├── logos/
│   ├── addrika-logo.png          (Your Addrika brand logo)
│   └── company-logo.png           (Centsibl Traders logo - optional)
│
└── products/
    ├── kesar-chandan.jpg          (Kesar Chandan product photo)
    ├── regal-rose.jpg              (Regal Rose product photo)
    ├── oriental-oudh.jpg           (Oriental Oudh product photo)
    └── bold-bakhoor.jpg            (Bold Bakhoor product photo)
```

## 📋 Image Requirements

### Logos:
- **Format:** PNG with transparent background
- **Size:** 200-400px width
- **File size:** 50-100 KB
- **Names:** 
  - addrika-logo.png (main brand logo)
  - company-logo.png (optional)

### Product Photos:
- **Format:** JPG or PNG
- **Size:** 800-1200px width
- **Aspect ratio:** 16:9 or 4:3 (landscape orientation)
- **File size:** 200-500 KB each
- **Names:**
  - kesar-chandan.jpg
  - regal-rose.jpg
  - oriental-oudh.jpg
  - bold-bakhoor.jpg

## 🚀 How to Upload

### Method 1: Via File System (if you have access)
1. Navigate to `/app/frontend/public/images/`
2. Place logos in `logos/` folder
3. Place product photos in `products/` folder
4. Use exact filenames as listed above

### Method 2: Via Code Upload
1. Save your images locally on your computer
2. Upload them through your hosting provider's file manager
3. Or use FTP/SFTP to upload to the correct folders

### Method 3: Use Image URLs (Alternative)
If you have images hosted elsewhere (Google Drive, Dropbox, etc.):
1. Get the direct image URL
2. Update the mockData.js file with these URLs
3. No need to upload files

## ✅ After Upload

Once images are uploaded, run:
```bash
sudo supervisorctl restart frontend
```

Your website will automatically use the new images!

## 💡 Tips

- **Compress images** before upload (use TinyPNG.com)
- **Use consistent naming** as specified above
- **Test images** load properly after upload
- **Keep backups** of original high-quality images
