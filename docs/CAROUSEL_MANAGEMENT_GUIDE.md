# 🎪 Home Page Carousel Management System - Complete Guide

## ✅ Status: FULLY IMPLEMENTED & READY TO USE

The home page carousel system is **production-ready** and allows superusers to manage multiple cards with images that display in a rotating carousel for public users.

---

## 📊 System Overview

### What It Does:
✅ Superusers can **add unlimited carousel cards** to the home page  
✅ Each card can have a **picture** (JPEG, PNG, WEBP, or GIF)  
✅ Pictures are **stored in the database** with metadata  
✅ When a picture is **deleted/removed**, the **file is automatically deleted**  
✅ Public users see a **rotating carousel** of all images  
✅ Carousel auto-rotates every **7 seconds**  

---

## 🗂️ System Architecture

### Database Schema
```sql
CREATE TABLE carousel_cards (
    id SERIAL PRIMARY KEY,
    position INT NOT NULL,          -- Display order (1, 2, 3...)
    image_url TEXT,                 -- Public URL: /uploads/carousel/...
    storage_key TEXT,               -- Internal filename for deletion
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### File Storage
- **Location:** `/backend/uploads/carousel/`
- **Public Access:** `/uploads/carousel/{filename}`
- **File Format:** `{timestamp}-{randomHash}.{ext}`
- **Supported Types:** JPEG, PNG, WEBP, GIF (up to 8MB)

---

## 🚀 How to Use - Superuser Interface

### 1️⃣ Access Carousel Management

**As a superuser, go to the Home Page:**
1. Login as superuser
2. Click "Home" in the navigation
3. You'll see the **editable carousel card grid**

### 2️⃣ Add a New Card

**Click the "Add Card" button** (+ sign)
- Creates an empty card slot
- Card appears in the grid ready for an image

### 3️⃣ Upload an Image

**Click "Upload" on a card:**
1. Select an image file (JPEG, PNG, WEBP, or GIF)
2. File size max: 8MB
3. Image uploads immediately to the server
4. Card displays the image thumbnail

### 4️⃣ Replace an Image

**Click "Replace" on a card with an image:**
1. Select a new image file
2. Old image is automatically deleted from disk
3. New image displays immediately

### 5️⃣ Delete Just the Image

**Click the trash icon** on a card:
- Removes the image from the card
- Card slot stays (can add new image later)
- Image file deleted from disk

### 6️⃣ Remove Entire Card

**Click the X button** on a card:
- Removes the entire card slot
- Associated image deleted from disk
- Card no longer appears in carousel

---

## 👥 How Public Users See It

### Desktop View:
```
┌─────────────────────────────────────┐
│   CAS Fitness Home Page             │
├─────────────────────────────────────┤
│                                     │
│        [Auto-Rotating Image]        │  ← Changes every 7 seconds
│        (Carousel Ribbon)            │
│                                     │
├─────────────────────────────────────┤
│    "CAS Fitness headline text"      │
│    (Editable by superuser)          │
├─────────────────────────────────────┤
```

### Carousel Behavior:
- Shows one image at a time
- Auto-advances to next image every 7 seconds
- Loops infinitely back to first image
- Falls back to default hero image if no cards exist

---

## 🔌 API Endpoints (Backend)

### Get All Cards
```bash
GET /api/carousel

Response:
{
  "cards": [
    {
      "id": 1,
      "position": 1,
      "imageUrl": "/uploads/carousel/1696847293000-abc123def456.jpg",
      "updatedAt": "2024-10-01T12:34:56Z"
    }
  ]
}
```

### Add New Card Slot
```bash
POST /api/carousel/cards
Authorization: Bearer {JWT_TOKEN}

Response:
{
  "card": {
    "id": 2,
    "position": 2,
    "imageUrl": null,
    "updatedAt": "2024-10-01T12:35:00Z"
  }
}
```

### Upload/Replace Image
```bash
POST /api/carousel/cards/{id}/image
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data

Body: 
  image: {file}

Response:
{
  "card": {
    "id": 1,
    "position": 1,
    "imageUrl": "/uploads/carousel/1696847293000-abc123def456.jpg",
    "updatedAt": "2024-10-01T12:36:00Z"
  }
}
```

### Delete Image (Keep Card)
```bash
DELETE /api/carousel/cards/{id}/image
Authorization: Bearer {JWT_TOKEN}

Response:
{
  "card": {
    "id": 1,
    "position": 1,
    "imageUrl": null,
    "updatedAt": "2024-10-01T12:37:00Z"
  }
}
```

### Delete Card (With Image)
```bash
DELETE /api/carousel/cards/{id}
Authorization: Bearer {JWT_TOKEN}

Response:
{
  "success": true
}
```

---

## 🛠️ Technical Details

### File Upload Process:
1. Superuser selects image in browser
2. Frontend sends to `POST /api/carousel/cards/{id}/image`
3. Multer middleware validates:
   - MIME type (JPEG, PNG, WEBP, GIF only)
   - File size (8MB max)
4. Service generates unique filename: `{timestamp}-{randomHash}.ext`
5. File written to `/backend/uploads/carousel/`
6. Public URL stored in database: `/uploads/carousel/{filename}`
7. Frontend displays image thumbnail immediately

### File Deletion Process:
1. Superuser clicks delete/remove
2. Frontend sends DELETE request
3. Backend queries current `storage_key`
4. Database record updated (image_url/storage_key cleared)
5. Async file deletion from disk

### Database Sync:
- Image metadata persisted in `carousel_cards` table
- `image_url` = public access path
- `storage_key` = internal filename for deletion
- `updated_at` = timestamp of last change

---

## 📋 Complete Feature Checklist

| Feature | Status | Details |
|---------|--------|---------|
| Add card slots | ✅ | Unlimited cards, position auto-incremented |
| Upload images | ✅ | JPEG, PNG, WEBP, GIF, up to 8MB |
| Replace images | ✅ | Old file auto-deleted |
| Delete images | ✅ | Card slot stays, can reuse |
| Remove cards | ✅ | Card + image deleted completely |
| Auto-rotation | ✅ | 7-second intervals, infinite loop |
| File cleanup | ✅ | Automatic deletion on removal |
| Database persistence | ✅ | All data stored in PostgreSQL |
| Fallback image | ✅ | Uses default hero image if no cards |
| Responsive design | ✅ | Mobile/tablet/desktop support |
| Error handling | ✅ | User-friendly error messages |
| Validation | ✅ | File type + size limits |

---

## 🎨 Carousel Card Component Structure

### Frontend Components:

**PictureCard.jsx** (Superuser management):
- Displays single card in edit grid
- Upload button (or "Replace" if image exists)
- Delete image button (trash icon)
- Remove card button (X icon)
- Error display

**CarouselRibbon.jsx** (Public display):
- Read-only rotating carousel
- Auto-advances every 7 seconds
- Responsive image container
- Infinite loop

**LandingPage.jsx** (Integration):
- Conditional rendering:
  - Superuser: editable grid + headline editor
  - Public: carousel ribbon + headline text
- Session error handling
- Unsaved changes guard

---

## 💾 Data Persistence

### What Gets Saved:
✅ Image file (on disk at `/backend/uploads/carousel/`)  
✅ Image URL (in database `carousel_cards.image_url`)  
✅ Storage key (in database `carousel_cards.storage_key`)  
✅ Card position (in database `carousel_cards.position`)  
✅ Creation/update timestamps  

### What Gets Deleted:
✅ Image file from disk when card/image removed  
✅ Database record when card removed  
✅ Associated metadata (image_url, storage_key)  

### Cleanup Triggers:
1. **Image deletion**: When "Delete image" clicked
2. **Image replacement**: Old file deleted before new one added
3. **Card removal**: Card + image both deleted

---

## 🔐 Security & Permissions

### Superuser Only:
- `POST /api/carousel/cards` - Add cards
- `POST /api/carousel/cards/{id}/image` - Upload images
- `DELETE /api/carousel/cards/{id}/image` - Delete images
- `DELETE /api/carousel/cards/{id}` - Remove cards

### Public Access:
- `GET /api/carousel` - Read card list
- Static file serving of `/uploads/carousel/*` images

### Authentication:
- JWT token required for all superuser actions
- `requireSuperuser` middleware enforces role=1
- Session invalidation handled gracefully

---

## 🐛 Troubleshooting

### "File upload failed" error:
- Check file is valid JPEG/PNG/WEBP/GIF
- Check file size < 8MB
- Check `curl http://localhost:5000/uploads/carousel` returns 200

### Images not displaying:
- Verify database has correct image_url
- Check `/backend/uploads/carousel/` directory exists
- Try hard-refresh browser (Ctrl+Shift+R)
- Check browser console for 404 errors

### "Failed to load carousel" on public view:
- Non-fatal error - falls back to default hero image
- Check backend logs for database errors

### "Session invalidated" error:
- Log out and log back in
- See SESSION_INVALIDATION_RESOLUTION.md

---

## 📊 Example Workflow

### Scenario: Create a promotional carousel

1. **Create Card 1:**
   - Click "Add Card"
   - Upload image: summer_promotion.jpg
   - ✅ Card displays in carousel

2. **Create Card 2:**
   - Click "Add Card"
   - Upload image: winter_sale.jpg
   - ✅ Card displays after 7 seconds

3. **Create Card 3:**
   - Click "Add Card"
   - Upload image: membership_bonus.jpg
   - ✅ Card rotates with others

4. **Public users see:**
   - Carousel auto-rotates: summer → winter → membership → summer...
   - Each image displays for 7 seconds
   - Infinite loop continues

5. **Update Promotion:**
   - Click "Replace" on Card 1
   - Upload new_summer_promo.jpg
   - Old file deleted, new image shows
   - ✅ Carousel updates immediately

6. **Remove Expired Campaign:**
   - Click X on Card 1
   - Card + image deleted
   - ✅ Carousel now shows 2 cards

---

## 🚀 Next Steps

### To Test the System:

1. **Start the servers:**
   ```bash
   cd backend && npm run dev    # Terminal 1
   cd frontend && npm run dev   # Terminal 2
   ```

2. **Login as superuser:**
   - Email: `castech7777@gmail.com`
   - Password: `User@123`

3. **Go to home page:**
   - Click "Home" in navigation
   - You'll see the editable card grid

4. **Add test cards:**
   - Click "Add Card" button
   - Upload 3-4 test images
   - Verify thumbnails display

5. **Test carousel:**
   - Logout or open new browser window
   - Go to home page
   - Watch images auto-rotate every 7 seconds

### To Use in Production:

1. Ensure `/backend/uploads/carousel/` is writable
2. Backup uploads directory regularly
3. Monitor disk space usage
4. Consider implementing cloud storage for scalability

---

## 🎯 Current Status

| Component | Status | Location |
|-----------|--------|----------|
| Database table | ✅ Ready | schema.sql |
| Backend API | ✅ Ready | routes/carousel.js |
| Object storage | ✅ Ready | services/objectStorage.js |
| Superuser UI | ✅ Ready | components/PictureCard.jsx |
| Public carousel | ✅ Ready | components/CarouselRibbon.jsx |
| Integration | ✅ Ready | pages/LandingPage.jsx |
| File serving | ✅ Ready | app.js static middleware |

**System is fully operational and ready for production use!** 🚀

---

## 📝 Quick Reference

### Adding Cards:
1. Login as superuser
2. Go to home page
3. Click "Add Card" button
4. Click "Upload" on the new card
5. Select image file
6. Done! Card appears in carousel

### Managing Images:
- **Upload:** New empty card
- **Replace:** Existing card with image
- **Delete:** Remove image, keep card
- **Remove:** Delete card + image entirely

### Public View:
- Carousel displays all images
- Auto-rotates every 7 seconds
- Falls back to default image if empty

---

**That's it! The system is ready to use. Start adding carousel cards to your home page! 🎉**
