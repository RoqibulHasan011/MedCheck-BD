# Walkthrough: MedCheck BD Platform

**MedCheck BD** is a full-stack, Bangladesh-focused medicine verification, price transparency, availability tracking, online pharmacy ordering, and pharmacy management web platform connecting **Customer → Pharmacy → Admin**.

## Project Location & Status
- **Directory**: `C:\Users\User\.gemini\antigravity\scratch\medcheck-bd`
- **Port**: `5000` (Accessible at `http://localhost:5000`)
- **Database**: Live MongoDB connection (`mongodb://127.0.0.1:27017/medcheck_bd`) with automated `mongodb-memory-server` fallback.
- **Dataset**: Pre-seeded with 67 verified Bangladeshi medicines (Square, Beximco, Incepta, Renata, Opsonin, ACME), 137 batches, 14 verified pharmacies, 750+ inventory records, and demo user accounts.

---

## What Was Updated & Resolved

### 1. Direct Online Medicine Purchase Flow ("Buy Medicine")
- **Customer Purchase Modal**: Added `openCustomerOrderModal()` in `client/js/main.js` allowing customers to order directly with:
  - Unit price, quantity counter (+/- controls), and estimated total calculation in BDT (`৳`).
  - Fulfillment options: **Home Delivery** (with address input) or **Pharmacy Pickup**.
  - Recipient name and Bangladeshi mobile phone prefilled from session.
  - Payment options: **Cash on Delivery (COD)**, **bKash**, and **Nagad**.
- **Backend Order Endpoint (`POST /api/sales/customer-order`)**:
  - Validates medicine and pharmacy stock in real-time.
  - Automatically deducts stock from the pharmacy's live inventory.
  - Creates a confirmed `Sale` record with unique receipt ID format (`MC-2026-XXXXXX`).
  - Automatically logs a `PURCHASE` record into the customer's personal `MedicineHistory`.
- **Integrated Purchase Triggers**:
  - **Live Inventory Table** (`pharmacy-details.html` & `pharmacy.js`): Added an Action column with active "Buy" buttons for in-stock medicines.
  - **Verification Screen** (`verify.html` & `verify.js`): "Buy Now" button placed in the "Verified Pharmacies With Stock" table.
  - **Price Check Comparison** (`price.html`): Direct "Order" button beside lowest price pharmacy rows.

### 2. Fixed Medicine History Persistence & 401 Session Handling (`history.html`)
- **Root Cause**: When database was re-seeded, old user IDs were invalidated. The browser's expired JWT token received an HTTP 401, leaving the history table permanently frozen on *"Loading your history records..."*.
- **Graceful Recovery**:
  - Clear stale tokens automatically on HTTP 401.
  - Display an intuitive notification banner with a 1-click button: `Connect Demo Customer Account` (`customer@gmail.com` / `Customer@123`).
  - Dual-layer storage: merged local browser history (`medcheck_local_history`) with cloud history so verifications and purchases are never lost even when offline or unauthenticated.
- **Receipt Linking**: Each purchase entry in history features a direct, clickable `<a href="receipt.html?id=MC-2026-XXXXXX">Receipt</a>` button.
- **Tailored Empty States**: Clear contextual messages and call-to-action buttons for "Purchases Only", "Verifications Only", and "All Records".

### 3. UI Alignment & Search Consistency (`pharmacies.html` & `style.css`)
- Added `.input-group { flex-wrap: nowrap; }` to prevent search buttons or input addons from breaking onto separate lines.
- Styled the "Filter by Available Medicine" input group with the exact same icon, sizing, and search button as the "Search Pharmacy Name" input group.

---

## Verification & Test Results

### 1. Automated Integration Test
```
Login success: true User: Shakil Mahmud
Total History count: 5
Purchase history count: 3
Verification history count: 2
Receipt lookup success: true Pharmacy: MedCare Pharmacy Dhanmondi
```

### 2. Live Order Placement Test
```
Placing test order for: Ace 500 mg at Care & Cure Pharmacy Mohammadpur
Order result: {
  success: true,
  message: 'Order placed successfully! Receipt MC-2026-950708 generated.',
  receiptId: 'MC-2026-950708',
  totalPrice: 2.7,
  unitPrice: 1.35,
  quantity: 2
}
New Purchase count in history: 4
```

### 3. Receipt Verification Test
```
Receipt lookup success: true
Receipt ID: MC-2026-950708
Customer: Shakil Mahmud (01711000003)
Pharmacy: Care & Cure Pharmacy Mohammadpur
Item: Ace 500 mg (Qty: 2, Total: ৳2.70)
```

---

## Ready-to-Use Demo Accounts
| Role | Email | Password | Quick-Fill Location |
| :--- | :--- | :--- | :--- |
| **Customer** | `customer@gmail.com` | `Customer@123` | 1-Click button on `login.html` & `history.html` |
| **Pharmacy** | `pharmacy@medcare.com` | `Pharmacy@123` | 1-Click button on `login.html` |
| **Admin** | `admin@medcheckbd.com` | `Admin@1234` | 1-Click button on `login.html` |
