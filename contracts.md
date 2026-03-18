# API Contracts & Integration Protocol

## Current Mock Data (Frontend)
Location: `/app/frontend/src/mockData.js`

### Mocked Data:
1. **fragrances** - 4 fragrance objects with descriptions and benefits
2. **packageSizes** - 2 package options (50g, 200g)
3. **csrActivities** - 6 CSR initiatives
4. **companyInfo** - Brand details and USPs

## Backend Implementation Required

### 1. Inquiry Management API

**Endpoint:** `POST /api/inquiries`

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "fragrance": "string",
  "packageSize": "string",
  "quantity": "number",
  "message": "string",
  "type": "retail" | "wholesale"
}
```

**Response:**
```json
{
  "id": "string",
  "message": "Inquiry received successfully",
  "inquiry": { /* inquiry object */ }
}
```

**MongoDB Collection:** `inquiries`

---

### 2. Get All Inquiries API (Admin)

**Endpoint:** `GET /api/inquiries`

**Response:**
```json
{
  "inquiries": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "phone": "string",
      "fragrance": "string",
      "packageSize": "string",
      "quantity": "number",
      "message": "string",
      "type": "string",
      "status": "pending" | "contacted" | "completed",
      "createdAt": "datetime"
    }
  ]
}
```

---

### 3. Product Data APIs (Optional - for dynamic content)

**Endpoint:** `GET /api/products/fragrances`
**Endpoint:** `GET /api/products/packages`
**Endpoint:** `GET /api/csr-activities`

---

## Frontend Integration Changes

### Files to Update:
1. `/app/frontend/src/components/InquiryModal.jsx`
   - Replace mock submission with actual API call to `POST /api/inquiries`
   - Handle loading states and error responses
   - Show toast notifications on success/failure

### Integration Steps:
1. Import axios
2. Replace console.log with API call: `axios.post(\`\${BACKEND_URL}/api/inquiries\`, formData)`
3. Handle response and errors properly
4. Keep toast notifications for user feedback

---

## Database Schema

### Inquiries Collection
```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required),
  phone: String (required),
  fragrance: String (required),
  packageSize: String (required),
  quantity: Number (required),
  message: String (optional),
  type: String (enum: ['retail', 'wholesale'], required),
  status: String (enum: ['pending', 'contacted', 'completed'], default: 'pending'),
  createdAt: Date (default: now),
  updatedAt: Date (default: now)
}
```

---

## Implementation Priority

1. ✅ Create Inquiry model in backend
2. ✅ Implement POST /api/inquiries endpoint
3. ✅ Implement GET /api/inquiries endpoint (for admin view)
4. ✅ Update frontend InquiryModal to use real API
5. ✅ Test inquiry submission flow

---

## Notes
- Mock data (fragrances, packages, CSR) will remain in frontend for now
- Can be moved to backend later if dynamic management is needed
- Focus on inquiry management as primary functionality
