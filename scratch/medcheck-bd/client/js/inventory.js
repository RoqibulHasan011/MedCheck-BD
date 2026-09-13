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
    loadAllMedicinesForSelect(),
  ]);
}

// Load stats and inventory table
async function loadPharmacyStatsAndInventory() {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

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

    renderInventoryTable(currentInventoryData);
  } catch (err) {
    showToast(`Inventory load error: ${err.message}`, 'danger');
  }
}

function renderInventoryTable(items) {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

  if (items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">No medicines currently in your inventory. Click "Add Medicine" to stock items.</td>
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
          <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="openEditInventoryModal('${item._id}', ${item.quantity}, ${item.sellingPrice}, ${item.purchasePrice})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteInventoryItem('${item._id}')">
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
  if (!alertContainer) return;

  try {
    const res = await fetch('/api/inventory/alerts', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const alerts = data.data || [];
    if (alerts.length === 0) {
      alertContainer.innerHTML = `
        <div class="text-center py-3 text-muted">
          <i class="fas fa-check-circle text-success me-1"></i> No critical stock or expiry alerts.
        </div>
      `;
      return;
    }

    alertContainer.innerHTML = alerts
      .slice(0, 5)
      .map(
        (a) => `
        <div class="alert alert-${a.level === 'danger' ? 'danger' : 'warning'} d-flex align-items-center mb-2 py-2 px-3 small border-0">
          <i class="fas ${a.level === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2"></i>
          <div>
            <strong>${a.title}:</strong> ${a.message}
          </div>
        </div>
      `
      )
      .join('');
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
    await loadPharmacyStatsAndInventory();

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
