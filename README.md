# Love Inc Global — Church Attendance System

A full-stack web application for Love Inc Global (Christian fellowship at Ashesi University, Ghana) to manage church attendance digitally.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Firebase project values in `.env`

### 3. Set up Firebase project
- Enable **Firestore Database** in your Firebase console
- Enable **Email/Password Authentication**
- Create admin user accounts manually in Firebase Console → Authentication → Users
- Deploy Firestore rules:
  ```bash
  firebase deploy --only firestore:rules
  ```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Firebase Hosting
```bash
npm run build
firebase deploy
```

---

## Project Structure

```
src/
  pages/
    CheckIn.jsx         # Public check-in page (/checkin?s={serviceId})
    Login.jsx           # Admin login (/login)
    Admin.jsx           # Admin dashboard (/admin) — Live, Services, Members, Stats
    NewService.jsx      # New service form (/admin/service/new)
    MemberProfile.jsx   # Member detail page (/admin/members/:id)
  components/
    Navbar.jsx          # Top navigation bar (admin only)
    StatsCard.jsx       # Stats summary card
    AttendanceTable.jsx # Real-time attendance table
    MemberTable.jsx     # Members list with search
    ServiceCard.jsx     # Service grid card with QR button
    QRModal.jsx         # QR code display modal
    NewServiceModal.jsx # Inline service creation modal
    ProtectedRoute.jsx  # Auth guard for admin routes
  firebase/
    config.js           # Firebase initialization
    auth.js             # signIn, signOut, onAuthStateChange
    members.js          # Member CRUD operations
    services.js         # Service CRUD + active service management
    attendance.js       # Check-in, real-time listeners, history
  styles/
    index.css           # Tailwind + custom design tokens
```

---

## User Roles
| Role         | Description                                    |
|-------------|------------------------------------------------|
| `member`     | Regular attendee                               |
| `leader`     | Cell/small group leader                        |
| `admin`      | Full dashboard access                          |
| `superadmin` | Admin + promote/demote roles, delete services  |

---

## Environment Variables

| Variable                          | Description              |
|----------------------------------|--------------------------|
| `VITE_FIREBASE_API_KEY`          | Firebase API key         |
| `VITE_FIREBASE_AUTH_DOMAIN`      | Firebase auth domain     |
| `VITE_FIREBASE_PROJECT_ID`       | Firebase project ID      |
| `VITE_FIREBASE_STORAGE_BUCKET`   | Firebase storage bucket  |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID   |
| `VITE_FIREBASE_APP_ID`           | Firebase app ID          |
| `VITE_APP_DOMAIN`                | Your deployed domain (for QR code URLs) |

---

## Logo Assets
Place your logo files in the `public/` folder:
- `public/global_white_png.png` — used on dark backgrounds (check-in, admin)
- `public/global_black.png` — used on light backgrounds (inside QR code)

---

## Design
- **Background**: `#0A0A0A`
- **Gold accent**: `#C9A84C`
- **Fonts**: Cormorant Garamond (headings) + DM Sans (body)
- Dark theme, minimal, premium feel
