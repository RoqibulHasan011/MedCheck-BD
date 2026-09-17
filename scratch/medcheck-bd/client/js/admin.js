/**
 * MedCheck BD - Admin Dashboard Client Script
 * Handles KPI stats, Chart.js analytics, pharmacy approvals, medicine registry, reports review, and access audit logs.
 */

let reportsChart = null;
let pharmacyAreaChart = null;
let medicineCategoryChart = null;

async function initAdminDashboard() {
  if (!enforceRoleGuard(['admin'])) return;

  await Promise.all([
    loadAdminStats(),
    loadPendingPharmacies(),
    loadAdminReports(),
    loadAdminMedicines(),
    loadAccessLogs(),
  ]);
}

// Load high-level KPIs and Chart.js visualizations
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const { cards, charts } = data.data;

    // Fill KPI cards
    document.getElementById('adminStatUsers').textContent = cards.totalUsers;
    document.getElementById('adminStatPharmacies').textContent = cards.totalPharmacies;
    document.getElementById('adminStatVerified').textContent = cards.verifiedPharmacies;
    document.getElementById('adminStatMedicines').textContent = cards.totalMedicines;
    document.getElementById('adminStatReports').textContent = cards.totalReports;
    document.getElementById('adminStatAlerts').textContent = cards.activeAlerts;

    // Initialize Chart.js
    renderAdminCharts(charts);
  } catch (err) {
    showToast(`Admin stats error: ${err.message}`, 'danger');
  }
}

function renderAdminCharts(charts) {
  // 1. Reports by category chart
  const reportsCtx = document.getElementById('reportsCategoryChart');
  if (reportsCtx) {
    const labels = charts.reportsByCategory.map((r) => r._id || 'General');
    const counts = charts.reportsByCategory.map((r) => r.count);

    if (reportsChart) reportsChart.destroy();
    reportsChart = new Chart(reportsCtx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Reports'],
        datasets: [
          {
            data: counts.length > 0 ? counts : [0],
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 28, padding: 8 } } },
      },
    });
  }

  // 2. Pharmacies by area
  const areaCtx = document.getElementById('pharmacyAreaChart');
  if (areaCtx) {
    const labels = charts.pharmaciesByArea.map((p) => p._id);
    const counts = charts.pharmaciesByArea.map((p) => p.count);

    if (pharmacyAreaChart) pharmacyAreaChart.destroy();
    pharmacyAreaChart = new Chart(areaCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Registered Pharmacies',
            data: counts,
            backgroundColor: '#0284c7',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  // 3. Medicines by therapeutic class
  const medCtx = document.getElementById('medicineCategoryChart');
  if (medCtx) {
    const labels = charts.medicinesByCategory.map((m) => m._id);
    const counts = charts.medicinesByCategory.map((m) => m.count);

    if (medicineCategoryChart) medicineCategoryChart.destroy();
    medicineCategoryChart = new Chart(medCtx, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: ['#10b981', '#06b6d4', '#f97316', '#6366f1', '#eab308', '#64748b'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 28, padding: 8 } } },
      },
    });
  }
}

// Load pending pharmacies for verification review
async function loadPendingPharmacies() {
  const tableBody = document.getElementById('pendingPharmaciesTable');
  const dashboardList = document.getElementById('dashboardPendingList');
  if (!tableBody && !dashboardList) return;

  try {
    const res = await fetch('/api/admin/pending-pharmacies', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const pharmacies = data.data || [];
    const badge = document.getElementById('badgePendingCount');
    if (badge) badge.textContent = pharmacies.length;

    if (tableBody) {
      if (pharmacies.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">
              <i class="fas fa-check-circle text-success me-1"></i> No pending pharmacy applications awaiting review.
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = pharmacies
          .map(
            (p) => `
          <tr>
            <td>
              <strong class="text-dark">${p.name}</strong>
              <div class="small text-muted">${p.address}</div>
            </td>
            <td>${p.ownerName}</td>
            <td class="font-monospace small">${p.licenseNumber}</td>
            <td><i class="fas fa-map-marker-alt text-danger me-1 small"></i>${p.area}, ${p.division}</td>
            <td><span class="status-pill pending">Pending</span></td>
            <td class="text-end">
              <button class="btn btn-sm btn-success py-1 px-2 me-1" onclick="approvePharmacy('${p._id}', '${p.name}')">
                <i class="fas fa-check me-1"></i> Approve
              </button>
              <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="rejectPharmacy('${p._id}', '${p.name}')">
                <i class="fas fa-times me-1"></i> Reject
              </button>
            </td>
          </tr>
        `
          )
          .join('');
      }
    }

    if (dashboardList) {
      if (pharmacies.length === 0) {
        dashboardList.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="fas fa-check-circle fa-2x text-success mb-2 d-block"></i>
            No pending applications awaiting review.
          </div>
        `;
      } else {
        dashboardList.innerHTML = pharmacies
          .slice(0, 3)
          .map(
            (p) => `
          <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
            <div>
              <strong class="text-navy small d-block">${p.name}</strong>
              <span class="small text-muted font-monospace">${p.licenseNumber} • ${p.area}</span>
            </div>
            <div>
              <a href="admin-approvals.html" class="btn btn-outline-success btn-sm py-0 px-2">Review</a>
            </div>
          </div>
        `
          )
          .join('');
      }
    }
  } catch (err) {
    showToast(`Pending pharmacies error: ${err.message}`, 'danger');
  }
}

// Approve pharmacy
async function approvePharmacy(id, name) {
  if (!confirm(`Are you sure you want to approve "${name}" as a Verified Pharmacy?`)) return;

  try {
    const res = await fetch(`/api/admin/pharmacies/${id}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(data.message, 'success');
    await loadAdminStats();
    await loadPendingPharmacies();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Reject pharmacy
async function rejectPharmacy(id, name) {
  if (!confirm(`Are you sure you want to reject the application for "${name}"?`)) return;

  try {
    const res = await fetch(`/api/admin/pharmacies/${id}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(data.message, 'info');
    await loadAdminStats();
    await loadPendingPharmacies();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Load suspicious medicine reports
async function loadAdminReports() {
  const tableBody = document.getElementById('adminReportsTable');
  const dashboardList = document.getElementById('dashboardReportsList');
  if (!tableBody && !dashboardList) return;

  try {
    const res = await fetch('/api/reports', { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const reports = data.data || [];

    if (tableBody) {
      if (reports.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">No reports submitted yet.</td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = reports
          .map((r) => {
            let statusBadge = 'bg-warning text-dark';
            if (r.status === 'Resolved') statusBadge = 'bg-success';
            if (r.status === 'Dismissed') statusBadge = 'bg-secondary';
            if (r.status === 'Under Investigation') statusBadge = 'bg-danger';

            return `
            <tr>
              <td class="font-monospace fw-bold">${r.reportId}</td>
              <td>
                <strong>${r.medicineName}</strong>
                ${r.batchNumber ? `<div class="small text-muted font-monospace">Batch: ${r.batchNumber}</div>` : ''}
              </td>
              <td><span class="badge bg-light text-danger border border-danger-subtle">${r.issueType}</span></td>
              <td class="small" style="max-width: 250px;">${r.description}</td>
              <td><span class="badge ${statusBadge}">${r.status}</span></td>
              <td class="text-end">
                <select class="form-select form-select-sm d-inline-block w-auto" onchange="updateReportStatus('${r._id}', this.value)">
                  <option value="">Change Status...</option>
                  <option value="Under Investigation">Investigating</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Dismissed">Dismiss</option>
                </select>
              </td>
            </tr>
          `;
          })
          .join('');
      }
    }

    if (dashboardList) {
      if (reports.length === 0) {
        dashboardList.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="fas fa-shield-check fa-2x text-success mb-2 d-block"></i>
            No community incident reports filed yet.
          </div>
        `;
      } else {
        dashboardList.innerHTML = reports
          .slice(0, 3)
          .map((r) => {
            let statusBadge = 'bg-warning text-dark';
            if (r.status === 'Resolved') statusBadge = 'bg-success';
            if (r.status === 'Dismissed') statusBadge = 'bg-secondary';
            if (r.status === 'Under Investigation') statusBadge = 'bg-danger';

            return `
            <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
              <div>
                <strong class="text-navy small d-block">${r.medicineName}</strong>
                <span class="badge bg-light text-danger border border-danger-subtle small">${r.issueType}</span>
              </div>
              <div class="text-end">
                <span class="badge ${statusBadge} small d-block mb-1">${r.status}</span>
                <a href="admin-reports.html" class="btn btn-outline-danger btn-sm py-0 px-2">Investigate</a>
              </div>
            </div>
          `;
          })
          .join('');
      }
    }
  } catch (err) {
    console.error('Reports load error', err);
  }
}

// Update report status
async function updateReportStatus(reportId, newStatus) {
  if (!newStatus) return;

  try {
    const res = await fetch(`/api/reports/${reportId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast(`Report updated to "${newStatus}"`, 'success');
    await loadAdminReports();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Load medicine registry in Admin portal
async function loadAdminMedicines() {
  const tableBody = document.getElementById('adminMedicinesTable');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/medicines?limit=50');
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const meds = data.data || [];
    tableBody.innerHTML = meds
      .map(
        (m) => `
      <tr>
        <td>
          <strong class="text-dark">${m.name}</strong>
          <div class="small text-muted">${m.dosageForm} • ${m.strength}</div>
        </td>
        <td>${m.genericName}</td>
        <td>${m.manufacturer}</td>
        <td class="font-monospace small">${m.registrationNumber}</td>
        <td class="fw-bold text-primary">${formatBDT(m.referencePrice)}</td>
        <td><span class="status-pill ${m.registrationStatus === 'REGISTERED' ? 'registered' : 'review'}">${m.registrationStatus}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteMedicine('${m._id}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Medicines load error', err);
  }
}

// Admin add new medicine
async function handleAdminAddMedicine(e) {
  e.preventDefault();
  const name = document.getElementById('adminMedName').value.trim();
  const genericName = document.getElementById('adminMedGeneric').value.trim();
  const manufacturer = document.getElementById('adminMedManufacturer').value.trim();
  const strength = document.getElementById('adminMedStrength').value.trim();
  const dosageForm = document.getElementById('adminMedDosageForm').value;
  const category = document.getElementById('adminMedCategory').value.trim();
  const registrationNumber = document.getElementById('adminMedRegNo').value.trim();
  const referencePrice = document.getElementById('adminMedPrice').value;

  try {
    const res = await fetch('/api/medicines', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        genericName,
        manufacturer,
        strength,
        dosageForm,
        category,
        registrationNumber,
        referencePrice,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Medicine registered to official database', 'success');
    const modalEl = document.getElementById('addMedicineModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    document.getElementById('adminAddMedicineForm').reset();
    await loadAdminMedicines();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Admin delete medicine
async function deleteMedicine(id) {
  if (!confirm('Are you sure you want to remove this medicine and its batches from the registry?')) return;

  try {
    const res = await fetch(`/api/medicines/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Medicine deleted', 'info');
    await loadAdminMedicines();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Load live access logs
async function loadAccessLogs() {
  const tableBody = document.getElementById('accessLogsTable');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/admin/access-logs?limit=25', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const logs = data.data || [];
    tableBody.innerHTML = logs
      .map(
        (l) => `
      <tr>
        <td class="font-monospace small">${new Date(l.timestamp).toLocaleTimeString()}</td>
        <td><span class="badge bg-light text-dark border">${l.action}</span></td>
        <td class="small">${l.userEmail} <span class="text-muted">(${l.userRole})</span></td>
        <td class="small">${l.resourceType}</td>
        <td class="small text-muted" style="max-width: 250px;">${l.details}</td>
        <td class="font-monospace small text-muted">${l.ipAddress}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    console.error('Access logs load error', err);
  }
}

// Dedicated Page Initializers
async function initAdminApprovalsPage() {
  if (!enforceRoleGuard(['admin'])) return;
  await loadPendingPharmacies();
}

async function initAdminMedicinesPage() {
  if (!enforceRoleGuard(['admin'])) return;
  await loadAdminMedicines();
}

async function initAdminReportsPage() {
  if (!enforceRoleGuard(['admin'])) return;
  await loadAdminReports();
}

async function initAdminLogsPage() {
  if (!enforceRoleGuard(['admin'])) return;
  await loadAccessLogs();
}

