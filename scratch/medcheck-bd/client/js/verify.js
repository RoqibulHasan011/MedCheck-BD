/**
 * MedCheck BD - Verification Client Script
 * Handles live medicine & batch verification lookups, barcode simulation, and UI rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('query');
  if (initialQuery) {
    const input = document.getElementById('verifyInput');
    if (input) input.value = decodeURIComponent(initialQuery);
    executeVerification(initialQuery);
  }

  // Initialize live autocomplete dropdown
  setupMedicineAutocomplete('verifyInput', (selectedName) => {
    executeVerification(selectedName);
  });
});

// Barcode simulation: sets demo barcode into search field
function simulateBarcodeScan(barcode = '894110000101') {
  const input = document.getElementById('verifyInput');
  if (!input) return;
  input.value = barcode;
  showToast(`Scanned Barcode: ${barcode}`, 'info');
  executeVerification(barcode);
}

// Main verification handler
async function handleVerifySubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('verifyInput');
  const query = input ? input.value.trim() : '';

  if (!query) {
    showToast('Please enter a medicine name, generic, batch or barcode', 'warning');
    return;
  }

  await executeVerification(query);
}

async function executeVerification(query) {
  const resultContainer = document.getElementById('verifyResultArea');
  const searchBtn = document.getElementById('verifySearchBtn');

  if (!resultContainer) return;

  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking records...';
  }

  resultContainer.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div>
      <p class="mt-3 text-muted fw-bold">Cross-referencing MedCheck BD Reference Database...</p>
    </div>
  `;

  try {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/verify/${encodeURIComponent(query)}`, { headers });
    const data = await res.json();

    if (!data.success || !data.matchFound) {
      renderNotFoundResult(query, data);
      return;
    }

    if (typeof saveLocalHistoryItem === 'function' && data.data && data.data.medicine) {
      saveLocalHistoryItem({
        medicineId: data.data.medicine.id,
        medicineName: data.data.medicine.name,
        genericName: data.data.medicine.genericName,
        manufacturer: data.data.medicine.manufacturer,
        batchNumber: data.data.batch ? data.data.batch.batchNumber : 'N/A',
        verificationStatus: data.verificationStatus || 'DATABASE MATCH',
        pharmacyName: 'MedCheck BD Verification',
        type: 'VERIFICATION',
      });
    }

    renderMatchResult(data);
  } catch (err) {
    resultContainer.innerHTML = `
      <div class="alert alert-danger shadow-sm border-0" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i> Verification query failed: ${err.message}
      </div>
    `;
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i class="fas fa-search me-2"></i>Verify Medicine';
    }
  }
}

function renderNotFoundResult(query, data) {
  const resultContainer = document.getElementById('verifyResultArea');

  let suggestionsHtml = '';
  if (data.suggestions && data.suggestions.length > 0) {
    suggestionsHtml = `
      <div class="mt-4 pt-3 border-top">
        <h6 class="fw-bold text-navy mb-2"><i class="fas fa-lightbulb text-warning me-2"></i>Did you mean one of these registered medicines?</h6>
        <div class="d-flex flex-wrap gap-2">
          ${data.suggestions
            .map(
              (s) => `
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="document.getElementById('verifyInput').value='${s.name}'; executeVerification('${s.name}');">
              <i class="fas fa-pills me-1"></i> ${s.name} <span class="text-muted small">(${s.genericName})</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  resultContainer.innerHTML = `
    <div class="card border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
      <div class="p-4" style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white;">
        <div class="d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-3">
            <i class="fas fa-times-circle fa-2x"></i>
            <div>
              <h4 class="mb-0 fw-bold">No Exact Database Match Found</h4>
              <small class="opacity-75">Verification Target: "${query}"</small>
            </div>
          </div>
          <span class="status-pill notfound text-white bg-dark bg-opacity-25 border-0">
            <i class="fas fa-ban me-1"></i> RECORD NOT FOUND
          </span>
        </div>
      </div>
      <div class="card-body p-4 bg-white">
        <p class="text-secondary mb-3">${data.message || 'No approved reference or registered batch found matching this term.'}</p>
        <div class="alert alert-warning border-0 small">
          <i class="fas fa-shield-alt text-warning me-2"></i>
          <strong>Precautionary Notice:</strong> Absence from this database does not solely confirm a counterfeit medicine, but warrants careful consultation with a licensed pharmacist or physician before consumption.
        </div>

        ${suggestionsHtml}

        <div class="d-flex flex-wrap gap-2 mt-4 pt-2 border-top">
          <a href="report.html?medicine=${encodeURIComponent(query)}" class="btn btn-outline-danger btn-sm">
            <i class="fas fa-flag me-1"></i> Report Unregistered / Suspicious Medicine
          </a>
          <a href="price.html?medicine=${encodeURIComponent(query)}" class="btn btn-outline-success btn-sm">
            <i class="fas fa-tags me-1"></i> Check Market Prices
          </a>
          <a href="verify.html" class="btn btn-light btn-sm ms-auto">Clear Search</a>
        </div>
      </div>
    </div>
  `;
}

function renderMatchResult(data) {
  const resultContainer = document.getElementById('verifyResultArea');
  const { medicine, batch, availablePharmacies } = data.data;
  const status = data.verificationStatus;

  let headerClass = 'verify-header-match';
  let iconClass = 'fa-check-circle';
  let pillClass = 'match';

  if (status === 'NEEDS REVIEW') {
    headerClass = 'verify-header-review';
    iconClass = 'fa-exclamation-circle';
    pillClass = 'review';
  } else if (status === 'ALERT DETECTED') {
    headerClass = 'verify-header-alert';
    iconClass = 'fa-exclamation-triangle';
    pillClass = 'alert';
  }

  let alertsHtml = '';
  if (data.alerts && data.alerts.length > 0) {
    alertsHtml = `
      <div class="alert alert-danger border-0 mb-4">
        <h6 class="fw-bold mb-2"><i class="fas fa-bell me-2"></i>Active Health Warnings & Alerts:</h6>
        <ul class="mb-0 ps-3">
          ${data.alerts.map((a) => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  let batchHtml = '<div class="text-muted small">No specific batch queried or registered for this item.</div>';
  if (batch) {
    let batchPill = 'match';
    if (batch.status === 'EXPIRING_SOON') batchPill = 'expiring';
    if (batch.status === 'EXPIRED' || batch.status === 'RECALLED' || batch.status === 'SUSPICIOUS') batchPill = 'alert';

    batchHtml = `
      <div class="row g-3">
        <div class="col-md-6">
          <div class="result-detail-row">
            <span class="result-detail-label">Batch Number</span>
            <span class="result-detail-value font-monospace">${batch.batchNumber}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Manufacturing Date</span>
            <span class="result-detail-value">${formatDate(batch.manufacturingDate)}</span>
          </div>
        </div>
        <div class="col-md-6">
          <div class="result-detail-row">
            <span class="result-detail-label">Expiry Date</span>
            <span class="result-detail-value">${formatDate(batch.expiryDate)}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">Batch Health Status</span>
            <span class="status-pill ${batchPill}">${batch.status}</span>
          </div>
        </div>
      </div>
    `;
  }

  let pharmacyStockHtml = '<div class="text-muted small py-2">No verified pharmacies currently report online stock for this medicine.</div>';
  if (availablePharmacies && availablePharmacies.length > 0) {
    pharmacyStockHtml = `
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead class="text-muted small">
            <tr>
              <th>Verified Pharmacy</th>
              <th>Area / Location</th>
              <th>Available Units</th>
              <th>Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${availablePharmacies
              .map(
                (p) => {
                  const loggedUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                  const canBuyOnline = !loggedUser || (loggedUser.role !== 'pharmacy' && loggedUser.role !== 'admin');
                  return `
              <tr>
                <td class="fw-bold">
                  <a href="pharmacy-details.html?id=${p.pharmacyId}" class="text-decoration-none text-dark">
                    ${p.name} <i class="fas fa-check-circle text-success small" title="Verified Pharmacy"></i>
                  </a>
                </td>
                <td><i class="fas fa-map-marker-alt text-danger me-1 small"></i>${p.area}</td>
                <td><span class="badge ${p.quantity < 10 ? 'bg-warning text-dark' : 'bg-success'}">${p.quantity} Units</span></td>
                <td class="fw-bold text-primary">${formatBDT(p.price)}</td>
                <td class="text-nowrap">
                  ${canBuyOnline ? `
                  <button class="btn btn-primary-custom btn-sm py-0 px-2 me-1" onclick='openCustomerOrderModal(${JSON.stringify({
                    medicineId: medicine.id,
                    medicineName: medicine.name,
                    genericName: medicine.genericName,
                    dosageForm: medicine.dosageForm,
                    strength: medicine.strength,
                    batchNumber: batch ? batch.batchNumber : "",
                    price: p.price,
                    pharmacyId: p.pharmacyId,
                    pharmacyName: p.name,
                    pharmacyArea: p.area
                  }).replace(/'/g, "&apos;")})'>
                    <i class="fas fa-shopping-cart me-1"></i>Buy
                  </button>
                  ` : ''}
                  <a href="pharmacy-details.html?id=${p.pharmacyId}" class="btn btn-outline-secondary btn-sm py-0 px-2">${canBuyOnline ? 'Details' : '<i class="fas fa-store me-1"></i>View Store'}</a>
                </td>
              </tr>
            `;
                }
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  resultContainer.innerHTML = `
    <div class="verify-result-card mb-4">
      <div class="${headerClass}">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div class="d-flex align-items-center gap-3">
            <i class="fas ${iconClass} fa-2x"></i>
            <div>
              <h4 class="mb-0 fw-bold">${medicine.name}</h4>
              <span class="small opacity-90">${medicine.genericName} • ${medicine.strength}</span>
            </div>
          </div>
          <div>
            <span class="status-pill ${pillClass} text-white bg-dark bg-opacity-25 border-0">
              <i class="fas fa-shield-alt me-1"></i> ${data.verificationStatus}
            </span>
          </div>
        </div>
      </div>

      <div class="p-4 bg-white">
        ${alertsHtml}

        <div class="row g-4">
          <!-- Left Column: Medicine Profile -->
          <div class="col-lg-6">
            <h6 class="text-uppercase text-muted fw-bold small mb-3">
              <i class="fas fa-pills text-primary me-2"></i>Medicine Information
            </h6>
            <div class="result-detail-row">
              <span class="result-detail-label">Brand Name</span>
              <span class="result-detail-value">${medicine.name}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Generic Name</span>
              <span class="result-detail-value">${medicine.genericName}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Manufacturer</span>
              <span class="result-detail-value">${medicine.manufacturer}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Dosage Form & Strength</span>
              <span class="result-detail-value">${medicine.dosageForm} (${medicine.strength})</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Therapeutic Class</span>
              <span class="result-detail-value">${medicine.category}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Reference / Official Price</span>
              <span class="result-detail-value text-primary fs-5">${formatBDT(medicine.referencePrice)} / unit</span>
            </div>
          </div>

          <!-- Right Column: Regulatory & Batch -->
          <div class="col-lg-6">
            <h6 class="text-uppercase text-muted fw-bold small mb-3">
              <i class="fas fa-file-medical-alt text-success me-2"></i>Regulatory Reference
            </h6>
            <div class="result-detail-row">
              <span class="result-detail-label">DGDA DAR Reg Number</span>
              <span class="result-detail-value font-monospace">${medicine.registrationNumber}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Registration Status</span>
              <span class="status-pill ${medicine.registrationStatus === 'REGISTERED' ? 'registered' : 'review'}">
                ${medicine.registrationStatus}
              </span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Database Barcode</span>
              <span class="result-detail-value font-monospace">${medicine.barcode}</span>
            </div>
            <div class="result-detail-row">
              <span class="result-detail-label">Verification Result</span>
              <span class="badge ${medicine.registrationStatus === 'REGISTERED' ? 'bg-success' : 'bg-warning'}">
                DATABASE MATCH ✓
              </span>
            </div>

            <h6 class="text-uppercase text-muted fw-bold small mt-4 mb-2">
              <i class="fas fa-box-open text-primary me-2"></i>Batch Verification Details
            </h6>
            ${batchHtml}
          </div>
        </div>

        <hr class="my-4">

        <!-- Available Nearby Verified Pharmacies -->
        <div>
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="text-uppercase text-muted fw-bold small mb-0">
              <i class="fas fa-store text-success me-2"></i>Verified Pharmacies With Stock
            </h6>
            <a href="price.html?medicine=${encodeURIComponent(medicine.name)}" class="small text-decoration-none fw-bold">
              Compare All Prices <i class="fas fa-arrow-right ms-1"></i>
            </a>
          </div>
          ${pharmacyStockHtml}
        </div>

        <!-- Action Links & Disclaimer -->
        <div class="alert alert-light border mt-4 mb-0 small text-muted">
          <i class="fas fa-info-circle text-primary me-1"></i>
          <strong>Important Verification Notice:</strong> ${data.disclaimer}
        </div>

        <div class="d-flex flex-wrap gap-2 mt-4 pt-2">
          <a href="medicine-details.html?id=${medicine.id}" class="btn btn-primary-custom btn-sm">
            <i class="fas fa-info-circle me-1"></i> View Full Medicine Profile
          </a>
          <a href="price.html?medicine=${encodeURIComponent(medicine.name)}" class="btn btn-outline-primary btn-sm">
            <i class="fas fa-tags me-1"></i> Compare Pharmacy Prices
          </a>
          <a href="report.html?medicine=${encodeURIComponent(medicine.name)}&batch=${batch ? encodeURIComponent(batch.batchNumber) : ''}" class="btn btn-outline-danger btn-sm ms-auto">
            <i class="fas fa-flag me-1"></i> Report Discrepancy
          </a>
        </div>
      </div>
    </div>
  `;
}
