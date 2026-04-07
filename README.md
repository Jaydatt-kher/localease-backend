# 🛠️ Local Service Marketplace — Backend API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white)

**Scalable RESTful API for a full-stack local service marketplace**

</div>

---

## 📖 Description

Backend for a **Local Service Marketplace** that connects customers with service providers (plumbers, electricians, cleaners, etc.). Handles the full lifecycle — service discovery, enquiry & bidding, booking, payment, and reviews — with three user roles: **customer**, **serviceProvider**, and **admin**.

---

## 🧰 Tech Stack

| | Technology |
|---|---|
| **Runtime / Framework** | Node.js (ESM) · Express.js v5 |
| **Database** | MongoDB · Mongoose v9 |
| **Auth** | JWT (Access + Refresh Tokens) · bcryptjs |
| **OTP / SMS** | Twilio |
| **Email** | Nodemailer |
| **File Upload** | Multer · Cloudinary |
| **Payments** | Razorpay |
| **Other** | express-rate-limit · PDFKit · slugify · dotenv |

---

## 📁 Project Structure

```
Backend/
├── configs/         # DB connection
├── controllers/
│   ├── admin/       # dashboard, users, providers, bookings, etc.
│   ├── customer/    # services, enquiry, bookings, reviews
│   ├── serviceProvider/  # profile, services, bids, bookings
│   ├── auth.controller.js
│   ├── payment.controller.js
│   └── notifications.controller.js
├── middleware/      # isAuth, authorizeRoles, multer, rateLimiter
├── models/          # 19 Mongoose models
├── routes/          # auth, admin, customer, provider, payment, notification
├── utils/           # token, otp, mail, cloudinary, twilio
├── upload/          # temp upload buffer
└── index.js         # entry point
```

---

## ⚙️ Installation

```bash
# 1. Clone & install
git clone https://github.com/your-username/local-service-backend.git
cd local-service-backend
npm install

# 2. Configure environment
cp .env.example .env   # fill in all values

# 3. Start dev server
node --watch index.js
```

Server runs at `http://localhost:8000`.

---

## 🔐 Environment Variables

```env
# Server
PORT=8000
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/<db>

# JWT
JWT_SECRET=your_jwt_secret
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Email (Nodemailer)
EMAIL=your_email@gmail.com
PASS=your_gmail_app_password

# Twilio (SMS OTP)
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH=your_twilio_auth_token
TWILIO_PHONE=+1xxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

> ⚠️ Never commit `.env` — it is already in `.gitignore`.

---

## 🌐 API Endpoints

> **Base URL:** `http://localhost:8000/api`  
> Protected routes require a valid `accessToken` cookie or `Authorization: Bearer <token>` header.

### 🔑 Auth — `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/signup` | Public | Register user |
| POST | `/signin` | Public | Login |
| POST | `/google-auth` | Public | Google OAuth login |
| POST | `/signout` | Public | Logout |
| POST | `/refresh-token` | Public | Refresh access token |
| POST | `/verify-otp-email` | Public | Verify email OTP |
| POST | `/reset-password-otp` | Public | Send password reset OTP |
| PATCH | `/reset-password` | Public | Reset password |
| PATCH | `/change-password` | Customer/Provider | Change password |
| POST | `/send-otp-mobile` | Customer/Provider | Send mobile OTP |
| POST | `/verify-otp-mobile` | Customer/Provider | Verify mobile OTP |

### 👤 Customer — `/api/customer`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET/PATCH/DELETE | `/profile` · `/update-profile` · `/delete-account` | Customer | Profile management |
| GET | `/services/all` · `/services/search` · `/services/:id` | Public | Browse services |
| GET | `/services/categories` · `/categories/:id/services` | Public | Browse categories |
| GET | `/providers/:serviceId` · `/provider-details/:id` · `/providers/nearby` | Public | Browse providers |
| POST | `/create-enquiry` | Customer | Submit service enquiry |
| POST | `/enquiry/:responseId/accept` | Customer | Accept provider bid |
| GET/DELETE | `/all-request` · `/cancel-enquiry/:id` | Customer | Manage enquiries |
| GET/PATCH | `/bookings` · `/bookings/:id` · `/bookings/:id/cancel` | Customer | Manage bookings |
| POST | `/reviews` | Customer | Submit review |

### 🔧 Service Provider — `/api/provider`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST/GET/PUT/DELETE | `/profile` · `/get-profile` · `/update-profile` | Provider | Profile management |
| POST | `/link-bank` | Provider | Link bank account |
| CRUD | `/create-service` · `/get-all-service` · `/update-service/:id` | Provider | Manage service offerings |
| GET | `/new-request` | Provider | View incoming enquiries |
| PUT | `/requests/:id/respond` · `/requests/:id/update` · `/requests/:id/ignore` | Provider | Manage bids |
| GET/PATCH | `/bookings` · `/bookings/:id` · `/bookings/:id/set-final-amount` | Provider | Manage bookings |
| POST | `/bookings/:id/start-job` · `/bookings/:id/generate-complete-otp` | Provider | Job lifecycle |

### 🛡️ Admin — `/api/admin` *(all routes require `admin` role)*

| Group | Endpoints |
|-------|-----------|
| **Dashboard** | KPIs, bookings trend, revenue trend, provider & booking status, category popularity |
| **Users** | List, view, block/unblock |
| **Providers** | List, view, approve, reject, block/unblock, delete/restore, pending list |
| **Services & Categories** | Full CRUD + image upload + stats |
| **Cities** | Full CRUD + stats |
| **Bookings / Payments / Reviews** | List, view, stats; delete reviews |
| **Notifications** | List, mark read, delete |
| **Settings / Profile** | Platform settings, admin profile & password |

### 💳 Payments — `/api/payments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify` | Verify payment signature |
| GET | `/history` | Payment history |

---

## 🔒 Authentication

**Dual-token JWT strategy:**

```
POST /signin  →  accessToken (short-lived) + refreshToken (long-lived)  →  stored as HttpOnly cookies
On expiry     →  POST /refresh-token  →  new accessToken issued silently
```

**RBAC Middleware** (`authorizeRoles`) protects every route by role:

| Role | Capabilities |
|------|-------------|
| `customer` | Browse, enquire, book, pay, review |
| `serviceProvider` | Manage offerings, respond to bids, handle bookings |
| `admin` | Full platform control — content, users, analytics, settings |

---

## ✨ Features

- **Auth** — Email/Google OAuth, email & mobile OTP, password reset, JWT refresh tokens
- **Enquiry & Bidding** — Customers post requests; providers bid; customer accepts best offer
- **Booking Lifecycle** — Created → Started (OTP) → Completed (OTP) → Reviewed
- **Payments** — Razorpay integration with signature verification
- **Media Uploads** — Cloudinary image uploads via Multer (up to 5 per service)
- **Admin Dashboard** — KPI metrics, trend analytics, full entity management
- **Rate Limiting** — 8 granular limiters across login, OTP, search, upload, and action routes
- **Notifications** — In-app notification system for bookings, bids, and approvals

---

## ⚠️ Error Handling

All errors follow a consistent response format:

```json
{ "success": false, "message": "Descriptive error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad Request — invalid/missing input |
| `401` | Unauthorized — invalid or expired token |
| `403` | Forbidden — insufficient role |
| `404` | Not Found |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error |

---

## 🚀 Deployment

### Render / Railway
1. Push to GitHub → connect repo in dashboard
2. **Build:** `npm install` · **Start:** `node index.js`
3. Add all env variables in the dashboard
4. Set `FRONTEND_URL` to your production frontend domain

### VPS (PM2 + Nginx)
```bash
npm install -g pm2
pm2 start index.js --name "service-api"
pm2 save && pm2 startup
```
Point Nginx as a reverse proxy to `localhost:8000`.

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

<div align="center">Built with ❤️ using Node.js, Express & MongoDB</div>
