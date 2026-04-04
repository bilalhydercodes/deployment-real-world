// Login page logic
// Students: direct login (invite code + password, no OTP)
// Staff (Teacher/Admin): login + OTP verification

let staffOtpSent = false;
let staffUserData = null;
let staffContactEmail = '';

// ── STUDENT LOGIN (direct, no OTP) ────────────────────────────────────────────
document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('studentBtn');
  btn.innerHTML = '<span class="loader"></span>';
  btn.disabled = true;
  loginOverlay.style.display = 'flex';

  const inviteCode = document.getElementById('inviteCode').value.trim();
  const password   = document.getElementById('studentPassword').value;

  try {
    const res = await fetch(API_BASE_URL + '/api/auth/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode, password }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data));
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'student.html', 800);
    } else {
      loginOverlay.style.display = 'none';
      shakeCard();
      showToast(data.message || 'Invalid credentials', 'error');
      btn.innerHTML = 'Enter Student Portal';
      btn.disabled = false;
    }
  } catch (err) {
    loginOverlay.style.display = 'none';
    shakeCard();
    showToast('Server error. Please try again.', 'error');
    btn.innerHTML = 'Enter Student Portal';
    btn.disabled = false;
  }
});

// ── STAFF LOGIN — Step 1: Verify credentials + send OTP ──────────────────────
document.getElementById('staffNextBtn').addEventListener('click', async () => {
  const btn = document.getElementById('staffNextBtn');
  btn.innerHTML = '<span class="loader"></span>';
  btn.disabled = true;
  loginOverlay.style.display = 'flex';

  try {
    let res, data, contact;

    if (staffLoginMode === 'teacher') {
      const inviteCode = document.getElementById('teacherCode').value.trim();
      const password   = document.getElementById('teacherCodePwd').value;

      if (!inviteCode || !password) {
        loginOverlay.style.display = 'none';
        shakeCard();
        showToast('Please enter Teacher Code and Password', 'error');
        btn.innerHTML = 'Continue'; btn.disabled = false;
        return;
      }

      res = await fetch(API_BASE_URL + '/api/teacher/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, password }),
      });
      contact = inviteCode;
    } else {
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('staffPassword').value;

      if (!email || !password) {
        loginOverlay.style.display = 'none';
        shakeCard();
        showToast('Please enter Email and Password', 'error');
        btn.innerHTML = 'Continue'; btn.disabled = false;
        return;
      }

      res = await fetch(API_BASE_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      contact = email;
    }

    data = await res.json();

    if (data.success) {
      staffUserData     = data.data;
      staffContactEmail = contact;

      // Send OTP to email (admin) or log to console (teacher with no email)
      const otpRes = await fetch(API_BASE_URL + '/api/otp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      });
      const otpData = await otpRes.json();

      if (otpData.success) {
        staffOtpSent = true;
        document.getElementById('staffStep1').classList.add('hidden');
        document.getElementById('staffStep2').classList.remove('hidden');
        document.getElementById('staffOtpHint').textContent = contact;
        showToast('OTP sent! Check your email or server console.', 'success');
        document.getElementById('staffOtpCode').focus();
        loginOverlay.style.display = 'none';
      } else {
        throw new Error(otpData.message || 'Failed to send OTP');
      }
    } else {
      loginOverlay.style.display = 'none';
      shakeCard();
      showToast(data.message || 'Invalid credentials', 'error');
    }
  } catch (err) {
    loginOverlay.style.display = 'none';
    shakeCard();
    showToast(err.message || 'Server error. Please try again.', 'error');
  } finally {
    btn.innerHTML = 'Continue';
    btn.disabled = false;
  }
});

// ── STAFF LOGIN — Back button ─────────────────────────────────────────────────
document.getElementById('staffBackBtn').addEventListener('click', () => {
  document.getElementById('staffStep2').classList.add('hidden');
  document.getElementById('staffStep1').classList.remove('hidden');
  staffOtpSent = false;
});

// ── STAFF LOGIN — Resend OTP ──────────────────────────────────────────────────
document.getElementById('staffResendOtp').addEventListener('click', async () => {
  const btn = document.getElementById('staffResendOtp');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch(API_BASE_URL + '/api/otp/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: staffContactEmail }),
    });
    const data = await res.json();
    showToast(data.success ? 'OTP resent!' : (data.message || 'Failed'), data.success ? 'success' : 'error');
  } catch {
    showToast('Server error.', 'error');
  } finally {
    btn.textContent = 'Resend OTP';
    btn.disabled = false;
  }
});

// ── STAFF LOGIN — Step 2: Verify OTP + complete login ────────────────────────
document.getElementById('staffLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!staffOtpSent) {
    showToast('Please complete step 1 first', 'error');
    return;
  }

  const btn = document.getElementById('staffBtn');
  const origText = btn.textContent;
  btn.innerHTML = '<span class="loader"></span>';
  btn.disabled = true;
  loginOverlay.style.display = 'flex';

  const otpCode = document.getElementById('staffOtpCode').value.trim();

  try {
    const otpRes = await fetch(API_BASE_URL + '/api/otp/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: staffContactEmail, otp: otpCode }),
    });
    const otpData = await otpRes.json();

    if (otpData.success) {
      localStorage.setItem('token', staffUserData.token);
      localStorage.setItem('user', JSON.stringify(staffUserData));
      showToast('Login successful! Redirecting...', 'success');

      setTimeout(() => {
        const role = String(staffUserData.role || '').toLowerCase().trim();
        if (role === 'admin')   window.location.href = 'admin.html';
        else if (role === 'teacher') window.location.href = 'teacher.html';
        else window.location.href = 'student.html';
      }, 800);
    } else {
      loginOverlay.style.display = 'none';
      shakeCard();
      showToast(otpData.message || 'Invalid OTP', 'error');
      btn.textContent = origText;
      btn.disabled = false;
    }
  } catch (err) {
    loginOverlay.style.display = 'none';
    shakeCard();
    showToast('Server error. Please try again.', 'error');
    btn.textContent = origText;
    btn.disabled = false;
  }
});
