/**
 * MedCheck BD - Pharmacy Dashboard & Inventory Client Script
 * Handles inventory CRUD, automatic low stock / expiry detection, POS sales and receipt generation.
 */

let currentInventoryData = [];
let allMedicinesCache = [];

// Initialize Pharmacy Dashboard
async function initPharmacyDashboard() {
  if (!enforceRoleGuard(['pharmacy', 'admin'])) return;

  await Promise.all([
    loadPharmacyStatsAndInventory(),
    loadPharmacyAlerts(),
  ]);
}

// Load stats, inventory table, and dashboard snapshot
async function loadPharmacyStatsAndInventory() {
  const tableBody = document.getElementById('inventoryTableBody');
  const dashboardLowStock = document.getElementById('dashboardLowStockList');
  const statTotalMedicines = document.getElementById('statTotalMedicines');
  if (!tableBody && !dashboardLowStock && !statTotalMedicines) return;

  try {
    const res = await fetch('/api/inventory', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    currentInventoryData = data.data || [];

    // Calculate metrics
    const totalMedicines = currentInventoryData.length;
    let lowStockCount = 0;
    let expiringCount = 0;

    currentInventoryData.forEach((item) => {
      if (item.quantity < 10) lowStockCount++;
      if (item.batchStatus === 'EXPIRING SOON' || item.batchStatus === 'EXPIRED') expiringCount++;
    });

    // Update KPI cards
    const totalMedEl = document.getElementById('statTotalMedicines');
    const lowStockEl = document.getElementById('statLowStock');
    const expiringEl = document.getElementById('statExpiring');
    const pharmacyTitleEl = document.getElementById('pharmacyDashboardTitle');

    if (totalMedEl) totalMedEl.textContent = totalMedicines;
    if (lowStockEl) lowStockEl.textContent = lowStockCount;
    if (expiringEl) expiringEl.textContent = expiringCount;
    if (pharmacyTitleEl && data.pharmacy) {
      pharmacyTitleEl.innerHTML = `
        ${data.pharmacy.name} 
        <span class="status-pill ${data.pharmacy.verified ? 'verified' : 'review'} ms-2">
          ${data.pharmacy.verified ? 'VERIFIED ✓' : 'PENDING APPROVAL'}
        </span>
      `;
    }

    if (tableBody) {
      renderInventoryTable(currentInventoryData);
    }

    if (dashboardLowStock) {
      renderDashboardAttentionList(currentInventoryData);
    }
  } catch (err) {
    showToast(`Inventory load error: ${err.message}`, 'danger');
  }
}

// Client-side search and status filter for live inventory
function filterInventoryTable() {
  const searchInput = document.getElementById('searchInventoryInput');
  const statusSelect = document.getElementById('filterInventoryStatus');
  const query = (searchInput?.value || '').toLowerCase().trim();
  const filter = statusSelect?.value || 'ALL';

  const filtered = currentInventoryData.filter((item) => {
    const name = (item.medicine?.name || '').toLowerCase();
    const generic = (item.medicine?.genericName || '').toLowerCase();
    const batch = (item.batch?.batchNumber || '').toLowerCase();

    const matchesQuery = !query || name.includes(query) || generic.includes(query) || batch.includes(query);

    let matchesStatus = true;
    if (filter === 'IN_STOCK') matchesStatus = item.quantity >= 10;
    else if (filter === 'LOW_STOCK') matchesStatus = item.quantity < 10 && item.quantity > 0;
    else if (filter === 'EXPIRING') matchesStatus = item.daysToExpiry <= 60;

    return matchesQuery && matchesStatus;
  });

  renderInventoryTable(filtered);
}

function renderInventoryTable(items) {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

  if (items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No medicines found matching the current search or filter criteria.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = items
    .map((item) => {
      let statusClass = 'instock';
      if (item.stockStatus === 'LOW STOCK') statusClass = 'lowstock';
      if (item.stockStatus === 'OUT OF STOCK' || item.batchStatus === 'EXPIRED') statusClass = 'expired';

      return `
      <tr>
        <td>
          <strong class="text-dark">${item.medicine ? item.medicine.name : 'N/A'}</strong>
          <div class="small text-muted">${item.medicine ? item.medicine.genericName : ''}</div>
        </td>
        <td class="font-monospace small">${item.batch ? item.batch.batchNumber : 'N/A'}</td>
        <td class="small ${item.batchStatus === 'EXPIRED' ? 'text-danger fw-bold' : ''}">
          ${item.batch ? formatDate(item.batch.expiryDate) : 'N/A'}
          ${item.daysToExpiry <= 60 ? `<span class="badge bg-warning text-dark ms-1">${item.daysToExpiry}d</span>` : ''}
        </td>
        <td>
          <span class="fw-bold">${item.quantity}</span>
        </td>
        <td class="text-muted small">${formatBDT(item.purchasePrice)}</td>
        <td class="fw-bold text-primary">${formatBDT(item.sellingPrice)}</td>
        <td>
          <span class="status-pill ${statusClass}">${item.stockStatus}</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openEditInventoryModal('${item._id}', ${item.quantity}, ${item.sellingPrice}, ${item.purchasePrice})" title="Edit Stock & Price">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteInventoryItem('${item._id}')" title="Remove Stock Item">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

// Load medicine list to populate dropdown
async function loadAllMedicinesForSelect() {
  try {
    const res = await fetch('/api/medicines?limit=100');
    const data = await res.json();
    if (data.success) {
      allMedicinesCache = data.data;
      const select = document.getElementById('addInvMedicineSelect');
      const posSelect = document.getElementById('posMedicineSelect');

      const optionsHtml = allMedicinesCache
        .map((m) => `<option value="${m._id}">${m.name} (${m.genericName}) - Ref: ৳${m.referencePrice}</option>`)
        .join('');

      if (select) select.innerHTML = '<option value="">Select Medicine...</option>' + optionsHtml;
      if (posSelect) posSelect.innerHTML = '<option value="">Choose item...</option>' + optionsHtml;
    }
  } catch (err) {
    console.error('Failed to load medicines list', err);
  }
}

// Add new inventory item
async function handleAddInventory(e) {
  e.preventDefault();
  const medicineId = document.getElementById('addInvMedicineSelect').value;
  const batchNumber = document.getElementById('addInvBatchNumber').value.trim();
  const expiryDate = document.getElementById('addInvExpiryDate').value;
  const quantity = document.getElementById('addInvQuantity').value;
  const purchasePrice = document.getElementById('addInvPurchasePrice').value;
  const sellingPrice = document.getElementById('addInvSellingPrice').value;

  if (!medicineId || !batchNumber || !quantity || !sellingPrice) {
    showToast('Please complete all required fields', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        medicineId,
        batchNumber,
        expiryDate: expiryDate || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Medicine added to inventory successfully', 'success');

    // Close modal if open
    const modalEl = document.getElementById('addInventoryModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('addInventoryForm').reset();
    await loadPharmacyStatsAndInventory();
    await loadPharmacyAlerts();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Open Edit Inventory modal
function openEditInventoryModal(id, currentQty, currentSelling, currentPurchase) {
  const modalEl = document.getElementById('editInventoryModal');
  if (!modalEl) return;

  document.getElementById('editInvId').value = id;
  document.getElementById('editInvQuantity').value = currentQty;
  document.getElementById('editInvSellingPrice').value = currentSelling;
  document.getElementById('editInvPurchasePrice').value = currentPurchase;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

// Update inventory item
async function handleUpdateInventory(e) {
  e.preventDefault();
  const id = document.getElementById('editInvId').value;
  const quantity = document.getElementById('editInvQuantity').value;
  const sellingPrice = document.getElementById('editInvSellingPrice').value;
  const purchasePrice = document.getElementById('editInvPurchasePrice').value;

  try {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ quantity, sellingPrice, purchasePrice }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Stock and price updated successfully', 'success');
    const modalEl = document.getElementById('editInventoryModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    await loadPharmacyStatsAndInventory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Delete inventory item
async function deleteInventoryItem(id) {
  if (!confirm('Are you sure you want to remove this medicine from your inventory?')) return;

  try {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Item deleted from inventory', 'info');
    await loadPharmacyStatsAndInventory();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Load pharmacy specific alerts
async function loadPharmacyAlerts() {
  const alertContainer = document.getElementById('pharmacyAlertsContainer');
  const detailedList = document.getElementById('detailedAlertsList');
  if (!alertContainer && !detailedList) return;

  try {
    const res = await fetch('/api/inventory/alerts', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const alerts = data.data || [];
    
    // 1. Dashboard summary container (first 5 alerts)
    if (alertContainer) {
      if (alerts.length === 0) {
        alertContainer.innerHTML = `
          <div class="text-center py-3 text-muted">
            <i class="fas fa-check-circle text-success me-1"></i> No critical stock or expiry alerts.
          </div>
        `;
      } else {
        alertContainer.innerHTML = alerts
          .slice(0, 5)
          .map(
            (a) => `
            <div class="alert alert-${a.level === 'danger' ? 'danger' : 'warning'} d-flex align-items-center mb-2 py-2 px-3 small border-0">
              <i class="fas ${a.level === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2"></i>
              <div class="flex-grow-1">
                <strong>${a.title}:</strong> ${a.message}
              </div>
              <a href="pharmacy-alerts.html" class="btn btn-sm btn-outline-dark py-0 px-2 ms-2">View</a>
            </div>
          `
          )
          .join('');
      }
    }

    // 2. Dedicated alerts page container (full breakdown)
    if (detailedList) {
      const alertBadgeEl = document.getElementById('statTotalAlerts');
      if (alertBadgeEl) alertBadgeEl.textContent = alerts.length;

      if (alerts.length === 0) {
        detailedList.innerHTML = `
          <div class="card-custom p-5 text-center bg-white">
            <i class="fas fa-shield-check fa-3x text-success mb-3"></i>
            <h5 class="fw-bold text-navy">All Medicine Stocks are Safe & Healthy!</h5>
            <p class="text-muted mb-0">No expired batches, no medicines near the 60-day threshold, and no critical inventory shortages.</p>
          </div>
        `;
      } else {
        detailedList.innerHTML = alerts
          .map((a) => {
            const isDanger = a.level === 'danger';
            return `
            <div class="card-custom p-3 mb-3 bg-white border-start border-4 ${isDanger ? 'border-danger' : 'border-warning'} shadow-sm">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle ${isDanger ? 'bg-danger bg-opacity-10 text-danger' : 'bg-warning bg-opacity-10 text-warning'} p-3">
                    <i class="fas ${isDanger ? 'fa-exclamation-circle' : 'fa-clock'} fa-lg"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-navy mb-1">${a.title}</h6>
                    <p class="text-muted small mb-0">${a.message}</p>
                  </div>
                </div>
                <div>
                  <a href="pharmacy-inventory.html" class="btn btn-outline-primary btn-sm">
                    <i class="fas fa-boxes me-1"></i> Manage in Inventory
                  </a>
                </div>
              </div>
            </div>
          `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.error('Alert load error', err);
  }
}

// Record Sale / POS System
async function handleRecordSale(e) {
  e.preventDefault();
  const medicineId = document.getElementById('posMedicineSelect').value;
  const batchNumber = document.getElementById('posBatchNumber').value.trim();
  const quantity = document.getElementById('posQuantity').value;
  const customerName = document.getElementById('posCustomerName').value.trim();
  const customerPhone = document.getElementById('posCustomerPhone').value.trim();
  const customerEmail = document.getElementById('posCustomerEmail').value.trim();
  const discount = document.getElementById('posDiscount').value || 0;
  const paymentMethod = document.getElementById('posPaymentMethod').value;
  const submitBtn = document.getElementById('recordSaleBtn');

  if (!medicineId || !quantity) {
    showToast('Please select medicine and quantity', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing Sale...';

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        customerName,
        customerPhone,
        customerEmail,
        discount,
        paymentMethod,
        items: [
          {
            medicineId,
            batchNumber,
            quantity: Number(quantity),
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`Sale completed! Receipt: ${data.receiptId}`, 'success');

    // Close POS modal
    const modalEl = document.getElementById('recordSaleModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    document.getElementById('posSaleForm').reset();
    await Promise.all([
      loadPharmacyStatsAndInventory(),
      loadPharmacySalesHistory(),
    ]);

    // Open Digital Receipt in new tab or prompt
    setTimeout(() => {
      window.open(`receipt.html?receiptId=${data.receiptId}`, '_blank');
    }, 800);
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-cash-register me-2"></i>Complete Sale & Print Receipt';
  }
}

// Load real-time sales and customer orders history for pharmacy
async function loadPharmacySalesHistory() {
  const tableBody = document.getElementById('pharmacySalesTableBody');
  const dashboardRecentOrders = document.getElementById('dashboardRecentOrdersList');
  const statTodaySalesEl = document.getElementById('statTodaySales');
  if (!tableBody && !dashboardRecentOrders && !statTodaySalesEl) return;

  try {
    const res = await fetch('/api/sales', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch sales');

    const sales = data.data || [];
    if (statTodaySalesEl) {
      statTodaySalesEl.textContent = `${sales.length} Orders`;
    }

    if (tableBody) {
      if (sales.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4 text-muted">
              <i class="fas fa-receipt fa-2x mb-2 d-block opacity-50"></i>
              No sales or orders recorded yet. Record a sale via POS or receive online orders from customers.
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = sales
          .map((s) => {
            const itemsSummary = (s.items || [])
              .map(
                (i) => `
              <div class="small">
                <strong>${i.medicineName}</strong> <span class="text-muted">(${i.quantity} units @ ${formatBDT(i.unitPrice)})</span>
              </div>
            `
              )
              .join('');

            const isOnline = s.paymentMethod === 'Cash on Delivery' || (s.items && s.items[0]?.batchNumber === 'BATCH-ONLINE');
            const channelBadge = isOnline
              ? '<span class="badge bg-info text-dark"><i class="fas fa-motorcycle me-1"></i>Customer Order</span>'
              : '<span class="badge bg-secondary"><i class="fas fa-cash-register me-1"></i>POS In-Store</span>';

            let payBadge = 'bg-primary';
            if (s.paymentMethod === 'Cash on Delivery') payBadge = 'bg-warning text-dark';
            else if (s.paymentMethod === 'bKash') payBadge = 'bg-danger';
            else if (s.paymentMethod === 'Nagad') payBadge = 'bg-danger-subtle text-danger border border-danger';
            else if (s.paymentMethod === 'Cash') payBadge = 'bg-success';

            return `
              <tr>
                <td class="font-monospace fw-bold text-navy">${s.receiptId}</td>
                <td>
                  <strong class="text-dark">${s.customerName || 'Customer'}</strong>
                  <div class="small text-muted">${s.customerPhone ? `<i class="fas fa-phone-alt me-1 text-success small"></i>${s.customerPhone}` : ''}</div>
                </td>
                <td>${itemsSummary || '<span class="text-muted">N/A</span>'}</td>
                <td>${channelBadge}</td>
                <td><span class="badge ${payBadge}">${s.paymentMethod || 'Cash'}</span></td>
                <td class="fw-bold text-success fs-6">${formatBDT(s.totalPrice)}</td>
                <td class="small text-muted">${formatDate(s.date)}</td>
                <td class="text-end">
                  <a href="receipt.html?id=${encodeURIComponent(s.receiptId)}" target="_blank" class="btn btn-outline-success btn-sm py-0 px-2" title="Print Digital Receipt">
                    <i class="fas fa-receipt me-1"></i> Receipt
                  </a>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }

    if (dashboardRecentOrders) {
      renderDashboardRecentOrders(sales);
    }
  } catch (err) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">${err.message}</td></tr>`;
  }
}

// Render Dashboard Snapshot: Items Requiring Urgent Attention (Low stock or expiring)
function renderDashboardAttentionList(items) {
  const container = document.getElementById('dashboardLowStockList');
  if (!container) return;

  const urgentItems = items
    .filter((i) => i.quantity < 10 || i.daysToExpiry <= 60)
    .slice(0, 4);

  if (urgentItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="fas fa-check-circle fa-2x text-success mb-2 d-block"></i>
        All medicine batches in stock are safe and well-supplied.
      </div>
    `;
    return;
  }

  container.innerHTML = urgentItems
    .map((item) => {
      const isLow = item.quantity < 10;
      const isExpiring = item.daysToExpiry <= 60;
      return `
      <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
        <div>
          <strong class="text-navy small d-block">${item.medicine ? item.medicine.name : 'Medicine'}</strong>
          <span class="font-monospace small text-muted">Batch: ${item.batch ? item.batch.batchNumber : 'N/A'}</span>
        </div>
        <div class="text-end">
          ${isLow ? `<span class="badge bg-warning text-dark me-1">${item.quantity} units left</span>` : ''}
          ${isExpiring ? `<span class="badge bg-danger">${item.daysToExpiry}d to expire</span>` : ''}
          <a href="pharmacy-inventory.html" class="btn btn-outline-primary btn-sm py-0 px-2 ms-2">Manage</a>
        </div>
      </div>
    `;
    })
    .join('');
}

// Render Dashboard Snapshot: Latest Transactions & Orders
function renderDashboardRecentOrders(sales) {
  const container = document.getElementById('dashboardRecentOrdersList');
  if (!container) return;

  const recent = sales.slice(0, 4);
  if (recent.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="fas fa-receipt fa-2x text-muted mb-2 d-block opacity-50"></i>
        No recent sales recorded yet today.
      </div>
    `;
    return;
  }

  container.innerHTML = recent
    .map((s) => {
      const isOnline = s.paymentMethod === 'Cash on Delivery' || (s.items && s.items[0]?.batchNumber === 'BATCH-ONLINE');
      return `
      <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
        <div>
          <span class="font-monospace fw-bold text-navy small">${s.receiptId}</span>
          <div class="small text-muted">${s.customerName || 'Customer'} • ${isOnline ? 'Online Order' : 'POS'}</div>
        </div>
        <div class="text-end">
          <div class="fw-bold text-success small">${formatBDT(s.totalPrice)}</div>
          <a href="receipt.html?id=${encodeURIComponent(s.receiptId)}" target="_blank" class="btn btn-outline-secondary btn-sm py-0 px-2 mt-1">Receipt</a>
        </div>
      </div>
    `;
    })
    .join('');
}

// Initialize Dedicated Inventory Page
async function initPharmacyInventoryPage() {
  if (!enforceRoleGuard(['pharmacy', 'admin'])) return;
  await Promise.all([
    loadPharmacyStatsAndInventory(),
    loadAllMedicinesForSelect(),
  ]);
}

// Initialize Dedicated Sales & Orders Page
async function initPharmacySalesPage() {
  if (!enforceRoleGuard(['pharmacy', 'admin'])) return;
  await Promise.all([
    loadPharmacySalesHistory(),
    loadAllMedicinesForSelect(),
  ]);

  // Handle ?action=pos only when explicitly directed and clean URL immediately
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'pos') {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      const modalEl = document.getElementById('recordSaleModal');
      if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    }, 250);
  }
}

// Initialize Dedicated Expiry & Safety Alerts Page
async function initPharmacyAlertsPage() {
  if (!enforceRoleGuard(['pharmacy', 'admin'])) return;
  await Promise.all([
    loadPharmacyAlerts(),
  ]);
}

