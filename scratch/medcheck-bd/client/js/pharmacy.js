/**
 * MedCheck BD - Pharmacy Directory & Stock Client Script
 * Handles pharmacy directory lookup, location filtering, and pharmacy profile stock rendering.
 */

// Load pharmacies on pharmacies.html
async function loadPharmacies() {
  const container = document.getElementById('pharmacyList');
  if (!container) return;

  const areaSelect = document.getElementById('filterArea');
  const searchInput = document.getElementById('searchPharmacy');
  const medicineInput = document.getElementById('filterMedicine');

  const area = areaSelect ? areaSelect.value : 'All Areas';
  const search = searchInput ? searchInput.value.trim() : '';
  const medicineName = medicineInput ? medicineInput.value.trim() : '';

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Loading verified pharmacies...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (area && area !== 'All Areas') params.append('area', area);
    if (search) params.append('search', search);
    if (medicineName) params.append('medicineName', medicineName);

    const res = await fetch(`/api/pharmacies?${params.toString()}`);
    const data = await res.json();

    if (!data.success || data.count === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="p-4 bg-white rounded-4 shadow-sm border text-center max-w-600 mx-auto">
            <i class="fas fa-store-slash fa-3x text-muted mb-3"></i>
            <h5 class="fw-bold text-navy">No Pharmacies Found</h5>
            <p class="text-muted small mb-4">
              No registered pharmacies directly matched your filter criteria 
              ${search ? `("<strong>${search}</strong>")` : ''} 
              ${area && area !== 'All Areas' ? `in <strong>${area}</strong>` : ''}
              ${medicineName ? `with <strong>${medicineName}</strong> in stock` : ''}.
            </p>
            <div class="p-3 bg-light rounded-3 mb-4">
              <span class="small fw-bold text-navy d-block mb-2"><i class="fas fa-lightbulb text-warning me-1"></i> Quick Search Suggestions:</span>
              <div class="d-flex flex-wrap justify-content-center gap-2">
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="quickFilterPharmacy('MedCare')">MedCare Pharmacy</button>
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="quickFilterPharmacy('Lazz Pharma')">Lazz Pharma</button>
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="quickFilterPharmacy('Tamanna')">Tamanna Mirpur</button>
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="quickFilterPharmacy('Popular')">Popular Uttara</button>
              </div>
            </div>
            <button class="btn btn-primary-custom btn-sm px-4" onclick="resetPharmacyFilters()">
              <i class="fas fa-undo-alt me-1"></i> Reset All Filters
            </button>
          </div>
        </div>
      `;
      return;
    }

    let bannerHtml = '';
    if (data.fallbackToAllAreas) {
      bannerHtml = `
        <div class="col-12 mb-4">
          <div class="alert alert-info border-0 shadow-sm d-flex flex-wrap align-items-center justify-content-between p-3 rounded-3">
            <div>
              <i class="fas fa-info-circle fa-lg me-2 text-primary"></i>
              <strong>Notice:</strong> ${data.message || `No pharmacy named "${search}" was found in ${data.searchedArea}. Showing matching branches in other areas:`}
            </div>
            <button class="btn btn-sm btn-outline-primary mt-2 mt-sm-0" onclick="setAreaFilter('All Areas')">
              <i class="fas fa-globe me-1"></i> View All Bangladesh
            </button>
          </div>
        </div>
      `;
    }

    const cardsHtml = data.data
      .map((p) => {
        const sampleMeds =
          p.availableSampleMedicines && p.availableSampleMedicines.length > 0
            ? p.availableSampleMedicines
                .map((m) => `<span class="badge bg-light text-dark border me-1 mb-1">${m}</span>`)
                .join('')
            : '<span class="text-muted small">Standard stock available</span>';

        return `
        <div class="col-lg-6 mb-4">
          <div class="card-custom h-100 p-4">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5 class="fw-bold mb-1 text-dark">${p.name}</h5>
                <span class="status-pill ${p.verified ? 'verified' : 'review'}">
                  ${p.verified ? '<i class="fas fa-check-circle me-1"></i> VERIFIED PHARMACY' : '<i class="fas fa-clock me-1"></i> PENDING VERIFICATION'}
                </span>
              </div>
              <span class="badge ${p.isOpenNow ? 'bg-success' : 'bg-secondary'} px-2 py-1">
                ${p.isOpenNow ? 'Open Now' : 'Closed'}
              </span>
            </div>

            <p class="text-secondary small mb-2">
              <i class="fas fa-map-marker-alt text-danger me-2"></i><strong>${p.area}, ${p.division || 'Dhaka'}:</strong> ${p.address}
            </p>
            <p class="text-secondary small mb-2">
              <i class="fas fa-phone-alt text-primary me-2"></i>${p.phone}
            </p>
            <p class="text-secondary small mb-3">
              <i class="fas fa-clock text-warning me-2"></i>Hours: ${p.openingHours || '8:00 AM - 11:00 PM'}
            </p>

            <div class="mb-3 pt-2 border-top">
              <span class="small text-muted fw-bold d-block mb-1">Available In-Stock:</span>
              <div>${sampleMeds}</div>
            </div>

            <div class="d-flex gap-2 mt-auto pt-2 border-top">
              <a href="pharmacy-details.html?id=${p._id}" class="btn btn-primary-custom btn-sm flex-grow-1">
                <i class="fas fa-boxes me-1"></i> View Stock & Prices
              </a>
              <a href="tel:${p.phone}" class="btn btn-outline-secondary btn-sm">
                <i class="fas fa-phone"></i>
              </a>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    container.innerHTML = bannerHtml + cardsHtml;
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 alert alert-danger" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i> Failed to load pharmacies: ${err.message}
      </div>
    `;
  }
}

function quickFilterPharmacy(name) {
  const searchInput = document.getElementById('searchPharmacy');
  if (searchInput) searchInput.value = name;
  loadPharmacies();
}

function setAreaFilter(areaName) {
  const areaSelect = document.getElementById('filterArea');
  if (areaSelect) areaSelect.value = areaName;
  loadPharmacies();
}

function resetPharmacyFilters() {
  const areaSelect = document.getElementById('filterArea');
  const searchInput = document.getElementById('searchPharmacy');
  const medicineInput = document.getElementById('filterMedicine');
  if (areaSelect) areaSelect.value = 'All Areas';
  if (searchInput) searchInput.value = '';
  if (medicineInput) medicineInput.value = '';
  loadPharmacies();
}

// Load pharmacy details on pharmacy-details.html
async function loadPharmacyDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const pharmacyId = urlParams.get('id');
  const profileContainer = document.getElementById('pharmacyProfileArea');
  const stockTableBody = document.getElementById('stockTableBody');

  if (!pharmacyId) {
    if (profileContainer) {
      profileContainer.innerHTML = `
        <div class="alert alert-warning">No pharmacy specified. Please select a pharmacy from the directory.</div>
      `;
    }
    return;
  }

  try {
    const res = await fetch(`/api/pharmacies/${pharmacyId}`);
    const data = await res.json();

    if (!data.success || !data.data) {
      throw new Error(data.message || 'Pharmacy not found');
    }

    const { pharmacy, stock } = data.data;

    if (profileContainer) {
      profileContainer.innerHTML = `
        <div class="card-custom p-4 mb-4">
          <div class="row align-items-center">
            <div class="col-lg-8">
              <div class="d-flex align-items-center gap-2 mb-2">
                <h3 class="fw-bold mb-0 text-navy">${pharmacy.name}</h3>
                <span class="status-pill ${pharmacy.verified ? 'verified' : 'review'}">
                  ${pharmacy.verified ? '<i class="fas fa-check-circle me-1"></i> VERIFIED PHARMACY' : '<i class="fas fa-clock me-1"></i> PENDING VERIFICATION'}
                </span>
              </div>
              <p class="text-secondary mb-2">
                <i class="fas fa-map-marker-alt text-danger me-2"></i><strong>${pharmacy.area}, ${pharmacy.division}:</strong> ${pharmacy.address}
              </p>
              <div class="d-flex flex-wrap gap-4 text-secondary small">
                <span><i class="fas fa-id-card text-primary me-1"></i> <strong>Drug License:</strong> ${pharmacy.licenseNumber}</span>
                <span><i class="fas fa-user-tie text-secondary me-1"></i> <strong>Manager:</strong> ${pharmacy.ownerName}</span>
                <span><i class="fas fa-phone-alt text-success me-1"></i> ${pharmacy.phone}</span>
                <span><i class="fas fa-clock text-warning me-1"></i> ${pharmacy.openingHours}</span>
              </div>
            </div>
            <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
              <a href="tel:${pharmacy.phone}" class="btn btn-primary-custom btn-sm me-2">
                <i class="fas fa-phone-alt me-1"></i> Contact Pharmacy
              </a>
              <a href="report.html?pharmacy=${encodeURIComponent(pharmacy.name)}" class="btn btn-outline-danger btn-sm">
                <i class="fas fa-flag me-1"></i> Report Issue
              </a>
            </div>
          </div>
        </div>
      `;
    }

    if (stockTableBody) {
      if (!stock || stock.length === 0) {
        stockTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4 text-muted">No medicines currently listed in this pharmacy's digital inventory.</td>
          </tr>
        `;
        return;
      }

      stockTableBody.innerHTML = stock
        .map((item) => {
          let statusBadgeClass = 'instock';
          if (item.stockStatus === 'LOW STOCK') statusBadgeClass = 'lowstock';
          else if (item.stockStatus === 'OUT OF STOCK' || item.stockStatus === 'EXPIRED') statusBadgeClass = 'expired';

          const medId = item.medicine ? (item.medicine._id || item.medicine.id) : '';
          const medName = item.medicine ? item.medicine.name : 'Unknown';
          const generic = item.medicine ? item.medicine.genericName : '';
          const dosage = item.medicine ? item.medicine.dosageForm : 'Tablet';
          const strength = item.medicine ? item.medicine.strength : '';
          const batchNo = item.batch ? item.batch.batchNumber : '';
          const isPurchasable = item.quantity > 0 && item.stockStatus !== 'EXPIRED' && item.stockStatus !== 'OUT OF STOCK';

          return `
          <tr>
            <td>
              <strong class="text-navy">${medName}</strong>
              <div class="small text-muted">${generic}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${dosage}</span></td>
            <td class="font-monospace small">${batchNo || 'N/A'}</td>
            <td>
              <span class="fw-bold">${item.quantity} units</span>
            </td>
            <td class="small ${item.batch && item.batch.status === 'EXPIRED' ? 'text-danger fw-bold' : ''}">
              ${item.batch ? formatDate(item.batch.expiryDate) : 'N/A'}
            </td>
            <td class="fw-bold text-primary">${formatBDT(item.sellingPrice)}</td>
            <td>
              <span class="status-pill ${statusBadgeClass}">${item.stockStatus}</span>
            </td>
            <td class="text-end">
              ${(() => {
                const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
                const userPharm = JSON.parse(localStorage.getItem('pharmacy') || 'null');
                const isOwnStore = userPharm && (userPharm._id === (pharmacy._id || pharmacy.id));

                if (currentUser && (currentUser.role === 'pharmacy' || currentUser.role === 'admin')) {
                  if (isOwnStore) {
                    return `<a href="pharmacy-inventory.html" class="btn btn-outline-primary btn-sm py-1 px-2"><i class="fas fa-boxes me-1"></i>Manage</a>`;
                  }
                  return isPurchasable
                    ? `<span class="badge bg-light text-secondary border py-1 px-2"><i class="fas fa-check-circle me-1 text-success"></i>Available</span>`
                    : `<span class="badge bg-light text-muted border py-1 px-2">Out of Stock</span>`;
                }

                return isPurchasable ? `
                  <button class="btn btn-primary-custom btn-sm py-1 px-2" onclick='openCustomerOrderModal(${JSON.stringify({
                    medicineId: medId,
                    medicineName: medName,
                    genericName: generic,
                    dosageForm: dosage,
                    strength: strength,
                    batchNumber: batchNo,
                    price: item.sellingPrice,
                    pharmacyId: pharmacy._id || pharmacy.id,
                    pharmacyName: pharmacy.name,
                    pharmacyArea: pharmacy.area || "Dhaka"
                  }).replace(/'/g, "&apos;")})'>
                    <i class="fas fa-shopping-cart me-1"></i>Buy
                  </button>
                ` : `
                  <button class="btn btn-outline-secondary btn-sm py-1 px-2" disabled>
                    Unavailable
                  </button>
                `;
              })()}
            </td>
          </tr>
        `;
        })
        .join('');
    }
  } catch (err) {
    if (profileContainer) {
      profileContainer.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }
}
