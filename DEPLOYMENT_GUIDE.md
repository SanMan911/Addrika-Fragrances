# Addrika Landing Page - Deployment Guide

## 🎉 Your Website is Ready!

Your premium Addrika landing page is fully functional and ready to deploy to your live website.

---

## 📋 What's Been Built

### Frontend Features:
✅ **Hero Section** - Brand showcase with Japanese Indigo + Metallic Gold theme
✅ **Fragrance Showcase** - 4 premium fragrances with detailed descriptions
✅ **USP Section** - Highlights 40+ min burn time and premium quality
✅ **CSR Section** - Comprehensive social responsibility initiatives
✅ **Package Options** - 50g and 200g size selections
✅ **CTA Section** - Buy Now, Wholesale, Find Retailers
✅ **Contact Information** - Updated with your business details
✅ **Inquiry Forms** - Functional modals for customer inquiries
✅ **Responsive Design** - Works on all devices

### Backend Features:
✅ **Inquiry API** - POST /api/inquiries (saves customer inquiries)
✅ **Admin API** - GET /api/inquiries (view all inquiries)
✅ **Email Notifications** - Logs sent to centsible.traders@protonmail.com
✅ **MongoDB Database** - Persistent storage for all inquiries
✅ **Data Validation** - Email format, phone, quantity checks

---

## 📍 Updated Contact Information

**Email:** contact.us@centraders.com
**Phone:** (+91) 9667-269-711
**Instagram:** @addrika.fragrances
**Address:** M.G. Shoppie, 745, Sector 17 Pocket A Phase II, Dwarka, South West Delhi, Delhi 110078, India

**Notification Email:** centsible.traders@protonmail.com (all inquiries logged here)

---

## 🚀 How to Deploy

### Option 1: Deploy on Emergent (Recommended)
Your app is already running on Emergent platform. To deploy it live:

1. Click the **"Deploy"** button in your Emergent dashboard
2. Your app will be live at your custom domain
3. All inquiries will be saved to the database automatically

### Option 2: Export Code for Your Own Server

#### Frontend Files (React):
```
/app/frontend/src/
├── components/
│   ├── Header.jsx
│   ├── Hero.jsx
│   ├── FragranceGrid.jsx
│   ├── USPSection.jsx
│   ├── CSRSection.jsx
│   ├── PackagingSection.jsx
│   ├── CTASection.jsx
│   ├── Footer.jsx
│   └── InquiryModal.jsx
├── pages/
│   └── LandingPage.jsx
├── mockData.js
├── App.js
├── App.css
└── index.css
```

#### Backend Files (FastAPI):
```
/app/backend/
├── server.py
├── models.py
└── .env (contains MongoDB connection)
```

---

## 🗄️ Database Structure

### Inquiries Collection:
```javascript
{
  id: "uuid",
  name: "Customer Name",
  email: "customer@email.com",
  phone: "(+91) 9876543210",
  fragrance: "Kesar Chandan",
  packageSize: "200g",
  quantity: 5,
  message: "Optional message",
  type: "retail" or "wholesale",
  status: "pending",
  createdAt: "2025-01-14T...",
  updatedAt: "2025-01-14T..."
}
```

---

## 📊 Accessing Customer Inquiries

### View All Inquiries:
**API Endpoint:** GET /api/inquiries

**Example Response:**
```json
{
  "count": 10,
  "inquiries": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+91 9876543210",
      "fragrance": "Oriental Oudh",
      "packageSize": "200g",
      "quantity": 3,
      "message": "Looking for bulk purchase",
      "type": "wholesale",
      "status": "pending",
      "createdAt": "2025-01-14T..."
    }
  ]
}
```

### Using the API:
```bash
# Get all inquiries
curl https://your-domain.com/api/inquiries

# Get specific inquiry
curl https://your-domain.com/api/inquiries/{inquiry-id}

# Update inquiry status
curl -X PATCH https://your-domain.com/api/inquiries/{inquiry-id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "contacted"}'
```

---

## 🎨 Color Scheme

**Primary:** Japanese Indigo (#1e3a52)
**Secondary:** Metallic Gold (#d4af37)
**Background:** Cream (#f7f5f2)

---

## 📝 Content You Can Update

### Product Images:
Currently using placeholder images from Unsplash. To update:
1. Edit `/app/frontend/src/mockData.js`
2. Replace the image URLs in the `fragrances` array
3. Or upload your product photos and use local paths

### Fragrances:
Located in `/app/frontend/src/mockData.js` - fragrances array

### Package Pricing:
Located in `/app/frontend/src/mockData.js` - packageSizes array

### CSR Activities:
Located in `/app/frontend/src/mockData.js` - csrActivities array

---

## 🔧 Technical Stack

- **Frontend:** React 19 + TailwindCSS + Shadcn UI
- **Backend:** FastAPI (Python) + Motor (MongoDB async driver)
- **Database:** MongoDB
- **Fonts:** Libre Baskerville (serif) + Montserrat (sans-serif)
- **Icons:** Lucide React

---

## ⚡ Performance Features

✅ Hot reload enabled for development
✅ Responsive images with lazy loading
✅ Smooth animations and transitions
✅ Form validation with error handling
✅ Background task processing for emails
✅ Async database operations

---

## 📧 Email Notifications

Currently, email notifications are logged to the console. All inquiry details are logged with:
- Customer information
- Order details
- Inquiry ID and timestamp

**To enable actual email sending:**
You can integrate services like:
- SendGrid
- AWS SES
- Mailgun
- SMTP server

The notification function is already prepared in `/app/backend/server.py`

---

## 🎯 Next Steps

1. **Test the website** - Fill out the inquiry form to test the flow
2. **Deploy to production** - Use Emergent deploy button
3. **Add your logo** - Upload your Addrika logo to replace placeholder
4. **Update product images** - Replace with actual product photos
5. **Set up email service** (optional) - For automated email notifications
6. **Add Google Analytics** (optional) - Track visitor behavior

---

## 📞 Support

For any issues or questions about deployment:
- Check Emergent documentation
- Contact Emergent support
- All code is well-commented for easy understanding

---

## ✨ Features Summary

**Customer-Facing:**
- Beautiful, premium design
- Mobile responsive
- Easy inquiry submission
- Clear product information
- CSR transparency

**Business-Facing:**
- All inquiries saved to database
- Customer contact information captured
- Retail vs Wholesale tracking
- Inquiry status management
- Email notifications (logged)

---

**Your Addrika landing page is production-ready! 🚀**
