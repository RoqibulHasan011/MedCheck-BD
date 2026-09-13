/**
 * MedCheck BD - Authentication Client Script
 * Handles Registration, Login, Token Management, and Role Guards.
 */

const API_BASE = '/api';

// Helper to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

// Check role guard on private dashboard pages
function enforceRoleGuard(allowedRoles = []) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    showToast('Please login to access your dashboard', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    return false;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    showToast(`Unauthorized access. Required: ${allowedRoles.join(', ')}`, 'danger');
    setTimeout(() => {
      if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
      else if (user.role === 'pharmacy') window.location.href = 'pharmacy-dashboard.html';
      else window.location.href = 'customer-dashboard.html';
    }, 1200);
    return false;
  }

  return true;
}

// Quick-fill demo login credentials
function quickFillLogin(role) {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  if (!emailInput || !passwordInput) return;

  if (role === 'admin') {
    emailInput.value = 'admin@medcheckbd.com';
    passwordInput.value = 'Admin@1234';
  } else if (role === 'pharmacy') {
    emailInput.value = 'pharmacy@medcare.com';
    passwordInput.value = 'Pharmacy@123';
  } else if (role === 'customer') {
    emailInput.value = 'customer@gmail.com';
    passwordInput.value = 'Customer@123';
  }
  showToast(`Auto-filled ${role.toUpperCase()} credentials`, 'info');
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginBtn');

  if (!email || !password) {
    showToast('Please provide both email and password', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Save tokens and user session
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.pharmacy) {
      localStorage.setItem('pharmacy', JSON.stringify(data.pharmacy));
    } else {
      localStorage.removeItem('pharmacy');
    }

    showToast(`Welcome back, ${data.user.name}!`, 'success');

    setTimeout(() => {
      if (data.user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else if (data.user.role === 'pharmacy') {
        window.location.href = 'pharmacy-dashboard.html';
      } else {
        window.location.href = 'customer-dashboard.html';
      }
    }, 800);
  } catch (err) {
    showToast(err.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Sign In';
  }
}

// Handle Customer Registration
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const submitBtn = document.getElementById('registerBtn');

  if (!name || !email || !phone || !password) {
    showToast('Please fill in all required fields', 'warning');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password, role: 'customer' }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    showToast('Account registered successfully! Welcome to MedCheck BD.', 'success');

    setTimeout(() => {
      window.location.href = 'customer-dashboard.html';
    }, 1000);
  } catch (err) {
    showToast(err.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i>Create Customer Account';
  }
}

// Handle Pharmacy Registration
async function handlePharmacyRegister(e) {
  e.preventDefault();
  const pharmacyName = document.getElementById('pharmacyName').value.trim();
  const ownerName = document.getElementById('ownerName').value.trim();
  const email = document.getElementById('pharmacyEmail').value.trim();
  const phone = document.getElementById('pharmacyPhone').value.trim();
  const password = document.getElementById('pharmacyPassword').value;
  const address = document.getElementById('pharmacyAddress').value.trim();
  const area = document.getElementById('pharmacyArea').value;
  const division = document.getElementById('pharmacyDivision').value;
  const licenseNumber = document.getElementById('licenseNumber').value.trim();
  const openingHours = document.getElementById('openingHours').value.trim();
  const submitBtn = document.getElementById('pharmacyRegBtn');

  if (!pharmacyName || !ownerName || !email || !phone || !password || !address || !licenseNumber) {
    showToast('Please provide all mandatory pharmacy fields and license details', 'warning');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting application...';

  try {
    const res = await fetch(`${API_BASE}/auth/pharmacy-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pharmacyName,
        ownerName,
        email,
        phone,
        password,
        address,
        area,
        division,
        licenseNumber,
        openingHours,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Pharmacy registration failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.pharmacy) {
      localStorage.setItem('pharmacy', JSON.stringify(data.pharmacy));
    }

    showToast(data.message, 'success');

    setTimeout(() => {
      window.location.href = 'pharmacy-dashboard.html';
    }, 1500);
  } catch (err) {
    showToast(err.message, 'danger');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-store me-2"></i>Register Pharmacy';
  }
}
