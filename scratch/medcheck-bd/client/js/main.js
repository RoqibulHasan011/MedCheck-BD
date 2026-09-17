/**
 * MedCheck BD - Global Client Script
 * Handles navigation rendering, authentication state detection, alerts and helpers.
 */

// Format currency into Bangladeshi Taka
function formatBDT(amount) {
  const val = Number(amount) || 0;
  return `৳${val.toFixed(2)}`;
}

// Format date into human-readable string
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Show responsive toast notification
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const icons = {
    success: 'fa-check-circle text-success',
    danger: 'fa-exclamation-triangle text-danger',
    warning: 'fa-exclamation-circle text-warning',
    info: 'fa-info-circle text-primary',
  };

  const toastId = 'toast_' + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center show shadow-lg border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true" style="border-radius: 12px; background: #ffffff;">
      <div class="d-flex p-3 align-items-center">
        <i class="fas ${icons[type] || icons.info} fa-lg me-3"></i>
        <div class="toast-body p-0 flex-grow-1" style="font-size: 0.92rem; font-weight: 500; color: #1e293b;">
          ${message}
        </div>
        <button type="button" class="btn-close ms-2" onclick="document.getElementById('${toastId}').remove()"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHtml);

  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4500);
}

// Render dynamic navbar based on user role and auth status
function renderNavbar() {
  const navContainer = document.getElementById('mainNavbar');
  if (!navContainer) return;

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const pharmacy = JSON.parse(localStorage.getItem('pharmacy') || 'null');
  const currentPath = window.location.pathname;

  let mainNavLinks = '';
  let authLinks = '';

  if (!token || !user) {
    // -------------------------------------------------------------
    // GUEST / PUBLIC VISITOR NAVBAR
    // -------------------------------------------------------------
    mainNavLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.endsWith('/') || currentPath.includes('index') ? 'active' : ''}" href="index.html">Home</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('verify') ? 'active' : ''}" href="verify.html">
          <i class="fas fa-check-circle text-success me-1"></i> Verify Medicine
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('price') ? 'active' : ''}" href="price.html">Price Check</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('pharmacies') ? 'active' : ''}" href="pharmacies.html">Find Pharmacy</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('report') ? 'active' : ''}" href="report.html">Report Issue</a>
      </li>
    `;

    authLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('login') ? 'active' : ''}" href="login.html">
          <i class="fas fa-sign-in-alt me-1"></i> Login
        </a>
      </li>
      <li class="nav-item ms-lg-2">
        <a class="btn btn-primary-custom btn-sm px-3" href="register.html">
          <i class="fas fa-user-plus me-1"></i> Register
        </a>
      </li>
    `;
  } else if (user.role === 'admin') {
    // -------------------------------------------------------------
    // ADMIN OVERSIGHT & GOVERNANCE NAVBAR
    // -------------------------------------------------------------
    mainNavLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom fw-bold ${currentPath.includes('admin-dashboard') ? 'active text-danger' : ''}" href="admin-dashboard.html">
          <i class="fas fa-chart-line text-danger me-1"></i> Admin Console
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('admin-approvals') ? 'active text-danger' : ''}" href="admin-approvals.html">
          <i class="fas fa-user-check text-success me-1"></i> Pharmacy Approvals
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('admin-medicines') ? 'active text-danger' : ''}" href="admin-medicines.html">
          <i class="fas fa-pills text-primary me-1"></i> Medicine Registry
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('admin-reports') ? 'active text-danger' : ''}" href="admin-reports.html">
          <i class="fas fa-flag text-warning me-1"></i> Safety Reports
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('admin-logs') ? 'active text-danger' : ''}" href="admin-logs.html">
          <i class="fas fa-clipboard-list text-info me-1"></i> Audit Trail
        </a>
      </li>
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle nav-link-custom text-secondary" href="#" id="adminPublicDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-globe me-1"></i> Consumer Portals
        </a>
        <ul class="dropdown-menu shadow-sm border-0" aria-labelledby="adminPublicDropdown">
          <li><a class="dropdown-item" href="index.html"><i class="fas fa-home me-2 text-muted"></i>Homepage</a></li>
          <li><a class="dropdown-item" href="verify.html"><i class="fas fa-shield-alt me-2 text-success"></i>Verify Medicine</a></li>
          <li><a class="dropdown-item" href="price.html"><i class="fas fa-tags me-2 text-primary"></i>Market Price Check</a></li>
          <li><a class="dropdown-item" href="pharmacies.html"><i class="fas fa-clinic-medical me-2 text-info"></i>Pharmacies Directory</a></li>
        </ul>
      </li>
    `;

    authLinks = `
      <li class="nav-item me-lg-2">
        <button class="btn btn-outline-danger btn-sm" onclick="openAdminAddMedModal()">
          <i class="fas fa-plus me-1"></i> Add Medicine
        </button>
      </li>
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle nav-link-custom d-flex align-items-center" href="#" id="adminUserDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-user-shield fa-lg me-2 text-danger"></i>
          <span class="fw-bold">${user.name ? user.name.split(' ')[0] : 'Admin'}</span>
          <span class="badge bg-danger ms-2">Central Admin</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" aria-labelledby="adminUserDropdown">
          <li><h6 class="dropdown-header text-muted">${user.email}</h6></li>
          <li><a class="dropdown-item" href="admin-dashboard.html"><i class="fas fa-columns me-2 text-danger"></i>Admin Console</a></li>
          <li><a class="dropdown-item" href="admin-approvals.html"><i class="fas fa-user-check me-2 text-success"></i>Pharmacy Approvals</a></li>
          <li><a class="dropdown-item" href="admin-medicines.html"><i class="fas fa-pills me-2 text-primary"></i>Medicine Database</a></li>
          <li><a class="dropdown-item" href="admin-reports.html"><i class="fas fa-flag me-2 text-warning"></i>Safety Reports</a></li>
          <li><a class="dropdown-item" href="admin-logs.html"><i class="fas fa-history me-2 text-info"></i>Security Audit Trail</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="logoutUser()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
        </ul>
      </li>
    `;
  } else if (user.role === 'pharmacy') {
    // -------------------------------------------------------------
    // PHARMACY PORTAL & DISPENSARY OPERATIONS NAVBAR
    // -------------------------------------------------------------
    const pharmacyId = pharmacy ? (pharmacy._id || pharmacy.id) : '';

    mainNavLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom fw-bold ${currentPath.includes('pharmacy-dashboard') ? 'active text-success' : ''}" href="pharmacy-dashboard.html">
          <i class="fas fa-columns text-success me-1"></i> Dashboard
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('pharmacy-inventory') ? 'active text-success' : ''}" href="pharmacy-inventory.html">
          <i class="fas fa-boxes text-primary me-1"></i> Stock Inventory
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('pharmacy-sales') ? 'active text-success' : ''}" href="pharmacy-sales.html">
          <i class="fas fa-file-invoice-dollar text-success me-1"></i> Sales & Orders
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('pharmacy-alerts') ? 'active text-success' : ''}" href="pharmacy-alerts.html">
          <i class="fas fa-bell text-danger me-1"></i> Expiry Alerts
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('verify') ? 'active text-success' : ''}" href="verify.html">
          <i class="fas fa-barcode text-secondary me-1"></i> Verify Batch
        </a>
      </li>
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle nav-link-custom text-secondary" href="#" id="pharmaMarketDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-store me-1"></i> Market View
        </a>
        <ul class="dropdown-menu shadow-sm border-0" aria-labelledby="pharmaMarketDropdown">
          <li><a class="dropdown-item" href="price.html"><i class="fas fa-tags me-2 text-primary"></i>Check Market Prices</a></li>
          <li><a class="dropdown-item" href="pharmacies.html"><i class="fas fa-clinic-medical me-2 text-info"></i>Pharmacies Directory</a></li>
          ${pharmacyId ? `<li><a class="dropdown-item" href="pharmacy-details.html?id=${pharmacyId}"><i class="fas fa-external-link-alt me-2 text-success"></i>My Public Store Profile</a></li>` : ''}
          <li><a class="dropdown-item" href="index.html"><i class="fas fa-home me-2 text-muted"></i>Consumer Homepage</a></li>
        </ul>
      </li>
    `;

    authLinks = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle nav-link-custom d-flex align-items-center" href="#" id="pharmacyUserDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-clinic-medical fa-lg me-2 text-success"></i>
          <span class="fw-bold">${pharmacy ? pharmacy.name.split(' ')[0] : (user.name ? user.name.split(' ')[0] : 'Pharmacy')}</span>
          <span class="badge bg-success ms-2">Pharmacy</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" aria-labelledby="pharmacyUserDropdown">
          <li><h6 class="dropdown-header text-muted">${pharmacy ? pharmacy.name : user.email}</h6></li>
          <li><a class="dropdown-item" href="pharmacy-dashboard.html"><i class="fas fa-columns me-2 text-success"></i>Pharmacy Dashboard</a></li>
          <li><a class="dropdown-item" href="pharmacy-inventory.html"><i class="fas fa-boxes me-2 text-primary"></i>Manage Stock Inventory</a></li>
          <li><a class="dropdown-item" href="pharmacy-sales.html"><i class="fas fa-receipt me-2 text-info"></i>Sales & Customer Orders</a></li>
          <li><a class="dropdown-item" href="pharmacy-alerts.html"><i class="fas fa-bell me-2 text-danger"></i>Expiry & Safety Alerts</a></li>
          ${pharmacyId ? `<li><a class="dropdown-item" href="pharmacy-details.html?id=${pharmacyId}"><i class="fas fa-store me-2 text-warning"></i>View Public Profile</a></li>` : ''}
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="logoutUser()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
        </ul>
      </li>
    `;
  } else {
    // -------------------------------------------------------------
    // CUSTOMER / PATIENT REGISTERED USER NAVBAR
    // -------------------------------------------------------------
    mainNavLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.endsWith('/') || currentPath.includes('index') ? 'active' : ''}" href="index.html">Home</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('verify') ? 'active' : ''}" href="verify.html">
          <i class="fas fa-check-circle text-success me-1"></i> Verify Medicine
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('price') ? 'active' : ''}" href="price.html">Price Check</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('pharmacies') ? 'active' : ''}" href="pharmacies.html">Find Pharmacy</a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('history') ? 'active' : ''}" href="history.html">
          <i class="fas fa-history text-primary me-1"></i> My History
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link nav-link-custom ${currentPath.includes('report') ? 'active' : ''}" href="report.html">Report Issue</a>
      </li>
    `;

    authLinks = `
      <li class="nav-item">
        <a class="nav-link nav-link-custom fw-bold text-primary ${currentPath.includes('customer-dashboard') ? 'active' : ''}" href="customer-dashboard.html">
          <i class="fas fa-columns me-1"></i> Dashboard
        </a>
      </li>
      <li class="nav-item dropdown ms-lg-2">
        <a class="nav-link dropdown-toggle nav-link-custom d-flex align-items-center" href="#" id="customerUserDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-user-circle fa-lg me-2 text-primary"></i>
          <span>${user.name ? user.name.split(' ')[0] : 'Customer'}</span>
          <span class="badge bg-primary ms-2">Customer</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" aria-labelledby="customerUserDropdown">
          <li><h6 class="dropdown-header text-muted">${user.email}</h6></li>
          <li><a class="dropdown-item" href="customer-dashboard.html"><i class="fas fa-tachometer-alt me-2 text-primary"></i>Dashboard</a></li>
          <li><a class="dropdown-item" href="history.html"><i class="fas fa-history me-2 text-info"></i>Medicine History</a></li>
          <li><a class="dropdown-item" href="report.html"><i class="fas fa-bullhorn me-2 text-warning"></i>Report Issue</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="logoutUser()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
        </ul>
      </li>
    `;
  }

  navContainer.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-custom sticky-top">
      <div class="container">
        <a class="brand-logo" href="index.html">
          <div class="brand-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div>
            <span class="d-block" style="line-height: 1.1;">MedCheck BD</span>
            <span class="brand-tagline">Verify. Compare. Find. Stay Safe.</span>
          </div>
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4">
            ${mainNavLinks}
          </ul>
          <ul class="navbar-nav mb-2 mb-lg-0 align-items-lg-center">
            ${authLinks}
          </ul>
        </div>
      </div>
    </nav>
  `;
}

// Global modal triggers for role actions
window.openPharmacyPosModal = function() {
  if (window.location.pathname.includes('pharmacy-sales.html')) {
    const modalEl = document.getElementById('recordSaleModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  } else {
    window.location.href = 'pharmacy-sales.html?action=pos';
  }
};

window.openAdminAddMedModal = function() {
  if (window.location.pathname.includes('admin-dashboard.html')) {
    const modalEl = document.getElementById('addMedicineModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  } else {
    window.location.href = 'admin-dashboard.html?action=add-medicine';
  }
};

// Render uniform footer across all pages
function renderFooter() {
  const footerContainer = document.getElementById('mainFooter');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer class="footer-custom">
      <div class="container">
        <div class="row g-4">
          <div class="col-lg-4 col-md-6">
            <div class="d-flex align-items-center gap-2 mb-3">
              <div class="brand-icon" style="width: 32px; height: 32px; font-size: 1rem;">
                <i class="fas fa-shield-alt"></i>
              </div>
              <span class="fw-bold text-white fs-5">MedCheck BD</span>
            </div>
            <p class="small text-secondary mb-3">
              A Bangladesh-focused healthcare technology platform dedicated to medicine reference verification, price transparency, verified pharmacy discovery, and consumer safety.
            </p>
            <div class="d-flex gap-3 text-secondary">
              <span class="badge bg-dark border border-secondary text-white-50"><i class="fas fa-shield-virus me-1"></i> DGDA Reference Data</span>
              <span class="badge bg-dark border border-secondary text-white-50"><i class="fas fa-laptop-medical me-1"></i> Health Tech MVP</span>
            </div>
          </div>
          <div class="col-lg-2 col-md-6">
            <h5>Quick Services</h5>
            <a href="verify.html" class="footer-link">Verify Medicine</a>
            <a href="price.html" class="footer-link">Medicine Price Check</a>
            <a href="pharmacies.html" class="footer-link">Find Verified Pharmacy</a>
            <a href="report.html" class="footer-link">Report Suspicious Batch</a>
          </div>
          <div class="col-lg-2 col-md-6">
            <h5>Portals</h5>
            <a href="login.html" class="footer-link">Customer Login</a>
            <a href="pharmacy-register.html" class="footer-link">Pharmacy Onboarding</a>
            <a href="pharmacy-dashboard.html" class="footer-link">Pharmacy Portal</a>
            <a href="admin-dashboard.html" class="footer-link">Admin Oversight</a>
          </div>
          <div class="col-lg-4 col-md-6">
            <h5>Safety Notice</h5>
            <div class="footer-disclaimer-box mt-0">
              <strong class="text-white"><i class="fas fa-info-circle text-primary me-1"></i> Important Disclaimer:</strong><br>
              MedCheck BD provides database and reference information. Medicine authenticity indicates Database Match and Verification Status, not guaranteed physical chemical testing. Always verify medicines with licensed physicians and registered pharmacies.
            </div>
          </div>
        </div>
        <hr class="border-secondary my-4 opacity-25">
        <div class="d-flex flex-wrap justify-content-between align-items-center small text-secondary">
          <div>© ${new Date().getFullYear()} MedCheck BD. Built for Bangladeshi Consumers & Pharmacies.</div>
          <div>All Bangladesh reference drug prices conform to DGDA benchmark standards.</div>
        </div>
      </div>
    </footer>
  `;
}

// Log out user
function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('pharmacy');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 600);
}

// Reusable Medicine Autocomplete Component
function setupMedicineAutocomplete(inputElementId, onSelectCallback) {
  const input = document.getElementById(inputElementId);
  if (!input) return;

  // Wrap in container if not already wrapped
  let wrapper = input.closest('.autocomplete-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
  }

  let dropdown = wrapper.querySelector('.autocomplete-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown d-none';
    wrapper.appendChild(dropdown);
  }

  let debounceTimer = null;
  let activeIndex = -1;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearTimeout(debounceTimer);
    activeIndex = -1;

    if (val.length < 1) {
      dropdown.classList.add('d-none');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/medicines/suggestions?q=${encodeURIComponent(val)}`);
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0) {
          dropdown.classList.add('d-none');
          dropdown.innerHTML = '';
          return;
        }

        dropdown.innerHTML = data.data
          .map(
            (m, i) => `
          <div class="autocomplete-item" data-index="${i}" data-name="${m.name}">
            <div>
              <div class="autocomplete-name"><i class="fas fa-pills text-primary me-2 small"></i>${m.name}</div>
              <div class="autocomplete-meta">${m.genericName} • ${m.dosageForm} • ${m.manufacturer}</div>
            </div>
            <div class="text-end ms-2">
              <span class="autocomplete-price">${formatBDT(m.referencePrice)}</span>
              <div class="small text-muted" style="font-size: 0.72rem;">Ref Price</div>
            </div>
          </div>
        `
          )
          .join('');

        dropdown.classList.remove('d-none');

        // Click listeners on items
        dropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const name = item.getAttribute('data-name');
            input.value = name;
            dropdown.classList.add('d-none');
            if (onSelectCallback) onSelectCallback(name);
          });
        });
      } catch (err) {
        console.error('Autocomplete fetch error', err);
      }
    }, 180);
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0 || dropdown.classList.contains('d-none')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        const name = items[activeIndex].getAttribute('data-name');
        input.value = name;
        dropdown.classList.add('d-none');
        if (onSelectCallback) onSelectCallback(name);
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.add('d-none');
    }
  });

  function updateActiveItem(items) {
    items.forEach((it, idx) => {
      if (idx === activeIndex) {
        it.classList.add('active');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('active');
      }
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.add('d-none');
    }
  });
}

// Reusable Pharmacy Autocomplete Component
function setupPharmacyAutocomplete(inputElementId, onSelectCallback) {
  const input = document.getElementById(inputElementId);
  if (!input) return;

  let wrapper = input.closest('.autocomplete-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
  }

  let dropdown = wrapper.querySelector('.autocomplete-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown d-none';
    wrapper.appendChild(dropdown);
  }

  let debounceTimer = null;
  let activeIndex = -1;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearTimeout(debounceTimer);
    activeIndex = -1;

    if (val.length < 1) {
      dropdown.classList.add('d-none');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pharmacies/suggestions?q=${encodeURIComponent(val)}`);
        const data = await res.json();

        if (!data.success || !data.data || data.data.length === 0) {
          dropdown.classList.add('d-none');
          dropdown.innerHTML = '';
          return;
        }

        dropdown.innerHTML = data.data
          .map(
            (p, i) => `
          <div class="autocomplete-item" data-index="${i}" data-name="${p.name}">
            <div>
              <div class="autocomplete-name"><i class="fas fa-clinic-medical text-success me-2 small"></i>${p.name}</div>
              <div class="autocomplete-meta">${p.area}, ${p.division || 'Dhaka'} • ${p.address}</div>
            </div>
            <div class="text-end ms-2">
              <span class="badge ${p.verified ? 'bg-success' : 'bg-secondary'}">${p.verified ? 'Verified' : 'Partner'}</span>
            </div>
          </div>
        `
          )
          .join('');

        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const name = item.getAttribute('data-name');
            input.value = name;
            dropdown.classList.add('d-none');
            if (onSelectCallback) onSelectCallback(name);
          });
        });
      } catch (err) {
        console.error('Pharmacy autocomplete fetch error', err);
      }
    }, 180);
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0 || dropdown.classList.contains('d-none')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        const name = items[activeIndex].getAttribute('data-name');
        input.value = name;
        dropdown.classList.add('d-none');
        if (onSelectCallback) onSelectCallback(name);
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.add('d-none');
    }
  });

  function updateActiveItem(items) {
    items.forEach((it, idx) => {
      if (idx === activeIndex) {
        it.classList.add('active');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('active');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.add('d-none');
    }
  });
}

// Local Medicine History Helpers
function getLocalHistoryKey() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const userId = user && (user.id || user._id);
    return userId ? `medcheck_local_history_${userId}` : 'medcheck_local_history_guest';
  } catch (e) {
    return 'medcheck_local_history_guest';
  }
}

function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(getLocalHistoryKey()) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLocalHistoryItem(item) {
  try {
    const list = getLocalHistory();
    list.unshift({
      _id: 'local_' + Date.now(),
      medicineId: item.medicineId || null,
      medicineName: item.medicineName || 'Medicine',
      genericName: item.genericName || '',
      manufacturer: item.manufacturer || '',
      batchNumber: item.batchNumber || 'N/A',
      verificationStatus: item.verificationStatus || 'DATABASE MATCH',
      pharmacyName: item.pharmacyName || '',
      type: item.type || 'VERIFICATION',
      notes: item.notes || '',
      checkedAt: new Date().toISOString(),
      isLocal: true,
    });
    localStorage.setItem(getLocalHistoryKey(), JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn('Could not save local history', e);
  }
}

function clearLocalHistory() {
  localStorage.removeItem(getLocalHistoryKey());
}

function removeLocalHistoryItem(id) {
  try {
    let list = getLocalHistory();
    list = list.filter(item => item._id !== id);
    localStorage.setItem(getLocalHistoryKey(), JSON.stringify(list));
  } catch (e) {
    console.warn('Could not remove local history item', e);
  }
}

// Global Reusable Customer Order Modal
window.openCustomerOrderModal = function (opts) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user && (user.role === 'pharmacy' || user.role === 'admin')) {
    showToast('Online medicine purchasing is for customer accounts. Pharmacies manage inventory through the Pharmacy Portal.', 'warning');
    return;
  }

  let modalEl = document.getElementById('customerOrderModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'customerOrderModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
          <div class="modal-header bg-navy text-white px-4 py-3">
            <h5 class="modal-title fw-bold">
              <i class="fas fa-shopping-cart text-success me-2"></i>Order Medicine Online
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <!-- Medicine & Pharmacy Card -->
            <div class="p-3 bg-light rounded-3 mb-3 border">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h5 class="fw-bold text-navy mb-0" id="orderMedName">Medicine Name</h5>
                  <div class="small text-muted" id="orderMedGeneric">Generic Details</div>
                </div>
                <div class="text-end">
                  <div class="fs-4 fw-bold text-primary" id="orderUnitPrice">৳0.00</div>
                  <small class="text-muted">per unit</small>
                </div>
              </div>
              <hr class="my-2 opacity-25">
              <div class="small text-secondary">
                <i class="fas fa-clinic-medical text-success me-1"></i> Dispensing Pharmacy: 
                <strong id="orderPharmacyName" class="text-dark">Pharmacy Name</strong>
                <span id="orderPharmacyArea" class="badge bg-white border text-dark ms-1">Area</span>
              </div>
            </div>

            <form id="customerOrderForm" onsubmit="submitCustomerOrder(event)">
              <!-- Quantity & Total -->
              <div class="row g-3 mb-3 align-items-center">
                <div class="col-sm-6">
                  <label class="form-label fw-bold text-navy small">Quantity (Units / Strips)</label>
                  <div class="input-group">
                    <button class="btn btn-outline-secondary" type="button" onclick="adjustOrderQty(-1)">-</button>
                    <input type="number" id="orderQuantity" class="form-control text-center fw-bold" value="1" min="1" max="100" required oninput="recalcOrderTotal()">
                    <button class="btn btn-outline-secondary" type="button" onclick="adjustOrderQty(1)">+</button>
                  </div>
                </div>
                <div class="col-sm-6 text-sm-end">
                  <span class="small text-muted d-block">Estimated Total:</span>
                  <div class="fs-3 fw-bold text-success" id="orderTotalPrice">৳0.00</div>
                </div>
              </div>

              <!-- Delivery Preference -->
              <div class="mb-3">
                <label class="form-label fw-bold text-navy small">Fulfillment Option</label>
                <div class="row g-2">
                  <div class="col-6">
                    <input type="radio" class="btn-check" name="orderDeliveryType" id="delivHome" value="Home Delivery" checked onchange="toggleOrderAddress(true)">
                    <label class="btn btn-outline-primary w-100 py-2 small fw-bold" for="delivHome">
                      <i class="fas fa-motorcycle me-1"></i> Home Delivery
                    </label>
                  </div>
                  <div class="col-6">
                    <input type="radio" class="btn-check" name="orderDeliveryType" id="delivPickup" value="Store Pickup" onchange="toggleOrderAddress(false)">
                    <label class="btn btn-outline-primary w-100 py-2 small fw-bold" for="delivPickup">
                      <i class="fas fa-walking me-1"></i> Pharmacy Pickup
                    </label>
                  </div>
                </div>
              </div>

              <!-- Customer Info -->
              <div class="row g-2 mb-3">
                <div class="col-sm-6">
                  <label class="form-label fw-bold text-navy small">Recipient Name *</label>
                  <input type="text" id="orderCustName" class="form-control form-control-sm" required placeholder="Your Full Name">
                </div>
                <div class="col-sm-6">
                  <label class="form-label fw-bold text-navy small">Mobile Phone (BD) *</label>
                  <input type="tel" id="orderCustPhone" class="form-control form-control-sm" required placeholder="01XXXXXXXXX">
                </div>
              </div>

              <!-- Delivery Address -->
              <div class="mb-3" id="orderAddressWrapper">
                <label class="form-label fw-bold text-navy small">Delivery Address *</label>
                <input type="text" id="orderCustAddress" class="form-control form-control-sm" placeholder="House, Road, Area, Dhaka...">
              </div>

              <!-- Payment Method -->
              <div class="mb-4">
                <label class="form-label fw-bold text-navy small">Payment Method</label>
                <select id="orderPaymentMethod" class="form-select form-select-sm">
                  <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                  <option value="bKash">bKash Mobile Payment</option>
                  <option value="Nagad">Nagad Mobile Payment</option>
                </select>
              </div>

              <button type="submit" id="orderSubmitBtn" class="btn btn-primary-custom w-100 py-2 fw-bold shadow">
                <i class="fas fa-check-circle me-1"></i> Confirm & Place Order
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  // Prepopulate modal with current options
  window._currentOrderOpts = opts;
  const unitPrice = Number(opts.price) || 1.2;

  document.getElementById('orderMedName').textContent = opts.medicineName || 'Selected Medicine';
  document.getElementById('orderMedGeneric').textContent = `${opts.genericName || ''} • ${opts.strength || ''}`;
  document.getElementById('orderUnitPrice').textContent = formatBDT(unitPrice);
  document.getElementById('orderPharmacyName').textContent = opts.pharmacyName || 'Verified Pharmacy';
  document.getElementById('orderPharmacyArea').textContent = opts.pharmacyArea || 'Dhaka';
  document.getElementById('orderQuantity').value = 1;

  // Prefill user data if logged in
  if (user) {
    document.getElementById('orderCustName').value = user.name || '';
    document.getElementById('orderCustPhone').value = user.phone || '';
  }

  recalcOrderTotal();
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
};

window.adjustOrderQty = function (delta) {
  const input = document.getElementById('orderQuantity');
  if (!input) return;
  let val = (parseInt(input.value) || 1) + delta;
  if (val < 1) val = 1;
  if (val > 100) val = 100;
  input.value = val;
  recalcOrderTotal();
};

window.recalcOrderTotal = function () {
  const input = document.getElementById('orderQuantity');
  const price = window._currentOrderOpts ? Number(window._currentOrderOpts.price) : 0;
  const qty = input ? Math.max(1, parseInt(input.value) || 1) : 1;
  const total = Number((price * qty).toFixed(2));
  const totalEl = document.getElementById('orderTotalPrice');
  if (totalEl) totalEl.textContent = formatBDT(total);
};

window.toggleOrderAddress = function (isDelivery) {
  const wrapper = document.getElementById('orderAddressWrapper');
  const input = document.getElementById('orderCustAddress');
  if (wrapper) wrapper.style.display = isDelivery ? 'block' : 'none';
  if (input) input.required = isDelivery;
};

window.submitCustomerOrder = async function (e) {
  if (e) e.preventDefault();
  const opts = window._currentOrderOpts || {};
  const btn = document.getElementById('orderSubmitBtn');

  const quantity = parseInt(document.getElementById('orderQuantity').value) || 1;
  const customerName = document.getElementById('orderCustName').value.trim();
  const customerPhone = document.getElementById('orderCustPhone').value.trim();
  const deliveryType = document.querySelector('input[name="orderDeliveryType"]:checked')?.value || 'Home Delivery';
  const customerAddress = document.getElementById('orderCustAddress')?.value.trim() || '';
  const paymentMethod = document.getElementById('orderPaymentMethod').value;

  if (deliveryType === 'Home Delivery' && !customerAddress) {
    showToast('Please enter your delivery address', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing order...';
  }

  try {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/sales/customer-order', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pharmacyId: opts.pharmacyId,
        medicineId: opts.medicineId,
        batchNumber: opts.batchNumber,
        quantity,
        customerName,
        customerPhone,
        customerAddress,
        deliveryType,
        paymentMethod,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to place order');

    // Save to local history immediately
    saveLocalHistoryItem({
      medicineId: opts.medicineId,
      medicineName: opts.medicineName,
      genericName: opts.genericName,
      manufacturer: opts.manufacturer,
      batchNumber: opts.batchNumber || 'BATCH-ONLINE',
      verificationStatus: 'PURCHASED',
      pharmacyName: opts.pharmacyName,
      type: 'PURCHASE',
      notes: `Receipt ${data.receiptId} • ${deliveryType}`,
    });

    // Close modal
    const modalEl = document.getElementById('customerOrderModal');
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();

    // Show success dialog
    showToast(`Order Confirmed! Receipt: ${data.receiptId}`, 'success');

    setTimeout(() => {
      if (confirm(`Order placed successfully!\nReceipt: ${data.receiptId}\n\nWould you like to view your printable digital receipt now?`)) {
        window.location.href = `receipt.html?id=${data.receiptId}`;
      } else if (window.location.pathname.includes('history.html')) {
        if (typeof loadCustomerHistory === 'function') loadCustomerHistory();
      }
    }, 400);
  } catch (err) {
    showToast(err.message, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle me-1"></i> Confirm & Place Order';
    }
  }
};

// Auto-run on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  renderFooter();
});

