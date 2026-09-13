# MedCheck BD 🇧🇩
### Bangladesh Medicine Verification, Price Comparison, Availability & Pharmacy Management Platform

> **"Verify. Compare. Find. Stay Safe."**

MedCheck BD is a full-stack health-tech web application and ecosystem designed to solve medicine authenticity concerns, pricing discrepancies, and availability challenges in Bangladesh. It connects **Consumers**, **Licensed Pharmacies**, and **Health Regulators/Admins** within a single unified platform.

---

## 🛡️ Important Regulatory & Healthcare Disclaimer
* **Not Physical Chemical Testing**: MedCheck BD is a software database verification and supply chain management system. Medicine authenticity is represented as **“Verification Status / Database Match / Alert Information”**, never as a guarantee of chemical purity from an image.
* **Official Data Notice**: Reference prices and DAR registration codes simulate official Bangladesh Directorate General of Drug Administration (DGDA) benchmarks using realistic demo data.
* Always verify prescriptions with licensed healthcare professionals and registered dispensing pharmacies.

---

## 🌟 Key Features

### 1. 🔍 Medicine & Batch Verification (`verify.html`)
* Search by **Brand Name**, **Generic Composition**, **Manufacturer**, **DAR Registration Number**, **Batch Code**, or **Barcode**.
* Clear status badges:
  * 🟢 **DATABASE MATCH / REGISTERED**: Details match verified Bangladesh pharmaceutical reference databases.
  * 🟡 **NEEDS REVIEW**: Batch nearing expiry (< 60 days) or regulatory records flagged for review.
  * 🔴 **ALERT / NOT FOUND / EXPIRED**: Recalled batch, expired product, or unlisted record.
* Real-time availability lookup showing which nearby verified pharmacies have current stock.

### 2. 🏷️ Price Transparency Engine (`price.html`)
* Instant comparison of pharmacy retail selling prices against official DGDA reference prices.
* Highlights **Lowest Available Price** across local stores.
* Color-coded variance indicators showing overpricing (`+৳`) or competitive discounts (`-৳`).

### 3. 🏥 Verified Pharmacy Directory (`pharmacies.html`, `pharmacy-details.html`)
* Search pharmacies by location: **Dhanmondi, Mirpur, Uttara, Mohammadpur, Gulshan, Banani, Chittagong, Sylhet, Rajshahi**, etc.
* Filter pharmacies by stock of a specific medicine.
* Full pharmacy profiles with DGDA Drug License number, contact info, operating hours, and live inventory tables.

### 4. 💼 Pharmacy Inventory & POS Point-of-Sale (`pharmacy-dashboard.html`)
* Real-time stock management (Add, Edit, Delete medicine stock).
* Automated stock status calculation:
  * `IN STOCK` (Quantity &ge; 10)
  * `LOW STOCK` (Quantity &lt; 10)
  * `OUT OF STOCK` (Quantity = 0)
  * `EXPIRING SOON` (Within 60 days)
  * `EXPIRED` (Past expiry date)
* POS Sales terminal: Deducts inventory automatically, records transactions, and generates printable **Digital Receipts**.

### 5. 🧾 Printable Digital Receipts (`receipt.html`)
* Generates unique verifiable receipt IDs (e.g. `MC-2026-XXXXXX`).
* Itemized medicine list with batch numbers, quantities, unit prices, discounts, and payment methods (Cash, bKash, Nagad, Card).
* Built-in print/PDF formatting (`window.print()`).

### 6. 👤 Customer Medicine History & Dashboard (`customer-dashboard.html`, `history.html`)
* Personal ledger of all verified medicines and pharmacy purchases.
* Filter by verification vs. purchase activities.
* Manage, inspect, or delete personal medical history logs.

### 7. 🚩 Community Reporting Engine (`report.html`)
* Allows consumers to report suspicious blister packs, counterfeit packaging, expired medicines, or price gouging.
* Generates a unique tracking Report ID (e.g. `RPT-2026-XXXX`) under "Pending Review".

### 8. 📊 Administrative Oversight Portal (`admin-dashboard.html`)
* High-level analytics powered by **Chart.js**:
  * Reports distribution by issue category (Counterfeit, Expired, Wrong Price, etc.)
  * Pharmacy registrations across Bangladesh divisions.
  * Medicine database distribution by therapeutic class.
* **1-Click Pharmacy Approvals**: Review pending drug licenses and grant the `VERIFIED PHARMACY ✓` badge.
* Suspicious report status updates (Investigating, Resolved, Dismissed).
* Official medicine database CRUD manager.
* **Security Access Logs**: Live audit stream of all sensitive actions (`LOGIN`, `VIEW_MEDICINE`, `RECORD_SALE`, `APPROVE_PHARMACY`).

---

## 💻 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+), Bootstrap 5.3, Font Awesome 6, Chart.js 4.4 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Embedded DB Fallback** | `mongodb-memory-server` (Runs with zero configuration if local MongoDB daemon is offline) |
| **Authentication** | JSON Web Tokens (JWT) & `bcryptjs` password hashing |
| **Architecture** | Modular MVC REST API with Role-Based Access Control (RBAC) |

---

## 🚀 Getting Started (Run Locally)

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher recommended; tested on Node v24)
* MongoDB (Optional - if local MongoDB daemon is running at `mongodb://127.0.0.1:27017`, it connects automatically; otherwise, it seamlessly spins up an embedded in-memory MongoDB database).

### 1. Installation
Open your terminal in the project directory:
```bash
npm install
```

### 2. Environment Setup
The `.env` file is pre-configured with default values:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/medcheck_bd
JWT_SECRET=medcheck_bd_super_secure_jwt_secret_key_2026_bangladesh
NODE_ENV=development
```

### 3. Run the Application
Start the server:
```bash
npm start
```
* On initial startup, the database is **automatically seeded** with 22+ Bangladeshi medicines, 10 pharmacies, batch records, and demo users.
* Open your browser at: **`http://localhost:5000`**

---

## 🔑 Demo Accounts (1-Click Login)
The login screen features convenient 1-click autofill buttons for evaluation:

| Role | Email | Password | Access & Capabilities |
|---|---|---|---|
| **Customer** | `customer@gmail.com` | `Customer@123` | Verify medicines, view personal history, track digital receipts, submit reports |
| **Pharmacy** | `pharmacy@medcare.com` | `Pharmacy@123` | Manage inventory, update stock/prices, view expiry warnings, record POS sales |
| **Admin** | `admin@medcheckbd.com` | `Admin@1234` | Full system analytics, approve pending pharmacies, review reports, audit logs |

---

## 📁 Project Folder Structure

```text
medcheck-bd/
├── client/
│   ├── index.html                 # Public Home Page & Workflow
│   ├── login.html                 # Multi-role Login with 1-click Demo Fill
│   ├── register.html              # Customer Registration
│   ├── pharmacy-register.html     # Pharmacy Onboarding Portal
│   ├── verify.html                # Medicine & Batch Verification
│   ├── medicine-details.html      # Comprehensive Regulatory & Batch Profile
│   ├── price.html                 # Price Check & Benchmark Variance Comparison
│   ├── pharmacies.html            # Verified Pharmacy Directory by Area
│   ├── pharmacy-details.html      # Pharmacy Profile & Live Stock Table
│   ├── customer-dashboard.html    # Customer Activity Hub
│   ├── pharmacy-dashboard.html    # Pharmacy Stock & POS Terminal
│   ├── admin-dashboard.html       # Admin Analytics, Approvals & Audit
│   ├── history.html               # Customer Medicine & Purchase Timeline
│   ├── receipt.html               # Printable Digital Receipt
│   ├── report.html                # Suspicious Medicine Reporting Form
│   ├── css/
│   │   └── style.css              # Custom Healthcare UI Stylesheet
│   └── js/
│       ├── auth.js                # JWT Session & Role Guards
│       ├── main.js                # Navbar, Footer & Toast Helpers
│       ├── verify.js              # Live Verification Engine
│       ├── pharmacy.js            # Pharmacy Directory & Stock Loader
│       ├── inventory.js           # Pharmacy Inventory & POS Handler
│       └── admin.js               # Admin Analytics & Actions
├── server/
│   ├── server.js                  # Express Server & Static Asset Dispatcher
│   ├── config/
│   │   └── db.js                  # Resilient MongoDB / In-Memory Fallback
│   ├── models/                    # Mongoose Schemas (User, Medicine, Batch, etc.)
│   ├── middleware/                # JWT Auth, RBAC & Access Logger
│   ├── routes/                    # Express REST API Endpoints
│   └── seed/
│       └── seedData.js            # Bangladesh Pharma Dataset Seeder
├── .env                           # Environment Variables
├── package.json                   # Project Manifest & Scripts
└── README.md                      # Documentation
```

---

## 📡 REST API Reference

### Authentication
* `POST /api/auth/register` - Register customer account
* `POST /api/auth/pharmacy-register` - Register pharmacy with license
* `POST /api/auth/login` - Authenticate user & receive JWT
* `GET /api/auth/me` - Get current session profile *(Protected)*

### Verification & Medicines
* `GET /api/verify/:query` - Verify medicine by name, generic, barcode, or batch
* `GET /api/medicines` - Search medicines with filters (category, dosage form, etc.)
* `GET /api/medicines/:id` - Single medicine details with batch breakdown
* `POST /api/medicines` - Register new medicine *(Admin)*
* `DELETE /api/medicines/:id` - Delete medicine & batches *(Admin)*

### Pharmacies & Stock
* `GET /api/pharmacies` - Search approved pharmacies by area or medicine
* `GET /api/pharmacies/:id` - Pharmacy profile and live stock table
* `GET /api/inventory/compare?query=...` - Price comparison across pharmacies

### Pharmacy Inventory & POS
* `GET /api/inventory` - Get logged-in pharmacy stock *(Pharmacy)*
* `POST /api/inventory` - Add medicine stock & batch *(Pharmacy)*
* `PUT /api/inventory/:id` - Update quantity or selling price *(Pharmacy)*
* `DELETE /api/inventory/:id` - Remove stock item *(Pharmacy)*
* `GET /api/inventory/alerts` - Low stock and expiry alerts *(Pharmacy)*
* `POST /api/sales` - Record POS sale, deduct stock, create receipt *(Pharmacy)*
* `GET /api/sales/receipt/:receiptId` - Verifiable receipt details *(Public/Protected)*

### Customer & Community
* `GET /api/history` - Customer verification and purchase history *(Customer)*
* `DELETE /api/history/:id` - Delete history entry *(Customer)*
* `POST /api/reports` - Submit suspicious medicine report *(Public/Customer)*

### Admin Oversight
* `GET /api/admin/stats` - System metrics and Chart.js aggregation *(Admin)*
* `GET /api/admin/pending-pharmacies` - List pharmacies awaiting approval *(Admin)*
* `PUT /api/admin/pharmacies/:id/approve` - Approve & mark verified *(Admin)*
* `PUT /api/admin/pharmacies/:id/reject` - Reject pharmacy application *(Admin)*
* `GET /api/admin/access-logs` - Live security audit trail *(Admin)*

---

## 🔒 Security Implementations
1. **Password Security**: Passwords hashed using `bcryptjs` with salt rounds = 10. Passwords never returned in queries (`select: false`).
2. **Role-Based Access Control (RBAC)**: Custom middleware checks user roles (`customer`, `pharmacy`, `admin`) before permitting protected mutations.
3. **Audit Logging**: Every critical action (`VIEW_MEDICINE`, `VERIFY_MEDICINE`, `RECORD_SALE`, `APPROVE_PHARMACY`) is logged with user role, timestamp, and IP into `AccessLog`.
4. **Input Sanitation & Strict Types**: Mongoose schema validations prevent invalid prices, negative stock, or duplicate license numbers.

---

## 🔮 Future Enhancements
* **Mobile Camera Barcode Scanner**: Integration of `html5-qrcode` or ZXing library for real-time mobile camera barcode and QR scanning.
* **DGDA Live API Integration**: Direct synchronization with the official Directorate General of Drug Administration (DGDA) database when an open API is published.
* **SMS Alerts**: Real-time SMS notifications via local BD gateways (e.g. SSL Wireless) when an adverse batch notice is published.
* **Geo-Location Radius Search**: Distance calculation using OpenStreetMap / Leaflet to sort pharmacies by exact distance in kilometers.

---

## 👨‍💻 License & Author
Built for **Academic Software Engineering & Web Development Evaluation** (Full-Stack MVP).
Released under the **MIT License**.
