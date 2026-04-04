// admin.js — School Management System Admin Panel
// All API calls, UI logic, pagination, search, modals

'use strict';

/* ── Auth guard ─────────────────────────────────────────────────── */
const _user = JSON.parse(localStorage.getItem('user') || 'null');
if (!_user || String(_user.role).toLowerCase() !== 'admin') {
  window.location.href = 'login.html';
}

/* ── Hide loader IMMEDIATELY — no waiting ───────────────────────── */
// Must run before anything else so loader never gets stuck
(function() {
  function hideLoader() {
    var pl = document.getElementById('pageLoader');
    if (pl) {
      pl.style.transition = 'opacity 0.3s ease';
      pl.style.opacity = '0';
      setTimeout(function() { if (pl.parentNode) pl.remove(); }, 350);
    }
  }
  // Hide after 100ms no matter what
  setTimeout(hideLoader, 100);
  // Also hide on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', hideLoader);
  // Also hide on window load
  window.addEventListener('load', hideLoader);
})();

/* ── Init ───────────────────────────────────────────────────────── */
document.getElementById('adminName').textContent = _user.name || 'Admin';

var _greeting = (typeof getGreeting === 'function') ? getGreeting() : 'Welcome';
var _dateStr  = (typeof getFormattedDate === 'function') ? getFormattedDate() : new Date().toLocaleDateString();

document.getElementById('dashGreeting').textContent = _greeting + ', ' + (_user.name || 'Admin') + '! 🛡️';
document.getElementById('headerDate').textContent = _dateStr;

/* ── Toast ──────────────────────────────────────────────────────── */
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  t.className = type || 'info';
  t.innerHTML = '<span style="font-weight:700;">' + (icons[type] || '') + '</span> ' + msg;
  t.classList.remove('hidden');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => t.classList.add('hidden'), 4000);
}

/* ── Confirm modal ──────────────────────────────────────────────── */
let _confirmCb = null;
function confirm2(title, msg, cb, btnLabel) {
  document.getElementById('confirmTitle').textContent = title || 'Are you sure?';
  document.getElementById('confirmMsg').textContent = msg || 'This cannot be undone.';
  const btn = document.getElementById('confirmOkBtn');
  btn.textContent = btnLabel || 'Delete';
  _confirmCb = cb;
  document.getElementById('confirmModal').classList.remove('hidden');
}
function closeConfirm() {
  document.getElementById('confirmModal').classList.add('hidden');
  _confirmCb = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  if (_confirmCb) _confirmCb();
  closeConfirm();
});

/* ── API helper ─────────────────────────────────────────────────── */
async function apiFetch(url, opts) {
  opts = opts || {};
  const token = localStorage.getItem('token');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  // Prefix relative URLs with the backend base URL
  const fullUrl = url.startsWith('http') ? url : API_BASE_URL + url;
  const res = await fetch(fullUrl, Object.assign({}, opts, { headers }));
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'An error occurred', 'error'); throw new Error(data.message); }
  return data;
}

/* ── Sidebar ────────────────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ── Section navigation ─────────────────────────────────────────── */
const _secNames = {
  dashboard:'Dashboard', students:'Students', teachers:'Teachers',
  sessions:'Classes', attendance:'Attendance', marks:'Marks',
  fees:'Fees', discipline:'Discipline', notices:'Notices',
  timetablemgr:'Timetable', leavemgr:'Leave Requests'
};
function showSection(name, btn) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + name + "'")) n.classList.add('active');
    });
  }
  document.getElementById('headerTitle').textContent = _secNames[name] || name;
  closeSidebar();
  if (name === 'students')    { loadStudents(); loadSessions(); }
  if (name === 'teachers')    { loadTeachers(); loadTeacherSessionsDropdown(); }
  if (name === 'sessions')    { loadSessions(); loadStudentsDropdown('manageStudentId'); }
  if (name === 'attendance')  loadAdminAttendance();
  if (name === 'marks')       loadAdminMarks();
  if (name === 'fees')        { loadFeesAdmin(); loadStudentsDropdown('feeStudentId'); }
  if (name === 'discipline')  loadAdminDiscipline();
  if (name === 'notices')     loadAdminNotices();
  if (name === 'timetablemgr'){ loadAdminTimetable(); loadSessions(); }
  if (name === 'leavemgr')    loadAdminLeaves();
}

/* ── Pagination helper ──────────────────────────────────────────── */
function renderPagination(containerId, page, totalPages, onPage) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (totalPages <= 1) { c.innerHTML = ''; return; }
  let html = '<div class="flex items-center gap-1">';
  html += '<button class="pg-btn" ' + (page <= 1 ? 'disabled' : '') + ' onclick="(' + onPage + ')(' + (page-1) + ')">‹ Prev</button>';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      html += '<button class="pg-btn ' + (i === page ? 'active' : '') + '" onclick="(' + onPage + ')(' + i + ')">' + i + '</button>';
    } else if (Math.abs(i - page) === 2) {
      html += '<span class="pg-btn" style="cursor:default;">…</span>';
    }
  }
  html += '<button class="pg-btn" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="(' + onPage + ')(' + (page+1) + ')">Next ›</button>';
  html += '</div>';
  html += '<span style="font-size:.75rem;color:#9ca3af;">Page ' + page + ' of ' + totalPages + '</span>';
  c.innerHTML = html;
}

/* ── Dashboard ──────────────────────────────────────────────────── */
async function loadDashboard() {
  // Show skeletons immediately
  ['totalStudents','totalTeachers','totalAttendance','pendingFees','totalDiscipline','totalMarks']
    .forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '...'; });

  const token = localStorage.getItem('token');
  const h = { Authorization: 'Bearer ' + token };
  try {
    // Single fast endpoint — 6 countDocuments in parallel server-side
    const res = await fetch(API_BASE_URL + '/api/admin/stats', { headers: h });
    const { data } = await res.json();
    if (!data) return;
    document.getElementById('totalStudents').textContent   = data.students   ?? '—';
    document.getElementById('totalTeachers').textContent   = data.teachers   ?? '—';
    document.getElementById('totalAttendance').textContent = data.attendance  ?? '—';
    document.getElementById('pendingFees').textContent     = data.pendingFees ?? '—';
    document.getElementById('totalDiscipline').textContent = data.discipline  ?? '—';
    if (document.getElementById('totalMarks'))
      document.getElementById('totalMarks').textContent   = data.marks       ?? '—';
  } catch(e) { console.error('Dashboard stats failed:', e); }
}

/* ── Students ───────────────────────────────────────────────────── */
let _allStudents = [], _studPage = 1;

async function loadStudents(page) {
  page = page || 1; _studPage = page;
  const search = document.getElementById('studentSearch')?.value || '';
  const status = document.getElementById('studentStatusFilter')?.value || '';
  const tbody = document.getElementById('studentsTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    let url = '/api/auth/students?page=' + page + '&limit=20';
    if (search) url += '&search=' + encodeURIComponent(search);
    const data = await apiFetch(url);
    _allStudents = data.data || [];
    let list = _allStudents;
    if (status === 'locked') list = list.filter(s => s.isLocked);
    if (status === 'active') list = list.filter(s => !s.isLocked);
    renderStudentsTable(list);
    const pg = data.pagination;
    if (pg) renderPagination('studentsPagination', pg.page, pg.totalPages, 'loadStudents');
    loadStudentsDropdown('manageStudentId');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-8">Failed to load</td></tr>';
  }
}

function filterStudents(q) { loadStudents(1); }

function renderStudentsTable(list) {
  const tbody = document.getElementById('studentsTable');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-10">No students found</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td><span class="font-medium text-gray-900">${s.name}</span></td>
      <td><span class="font-mono text-xs px-2 py-1 rounded-lg" style="background:rgba(249,115,22,.08);color:#ea580c;">${s.inviteCode || '—'}</span></td>
      <td class="text-gray-500">${s.email || '—'}</td>
      <td>${s.isLocked
        ? '<span class="badge badge-absent">🔒 Locked</span>'
        : '<span class="badge badge-present">✓ Active</span>'}</td>
      <td class="text-gray-400 text-xs">${new Date(s.createdAt).toLocaleDateString()}</td>
      <td>
        <button onclick="toggleLock('${s._id}', ${!s.isLocked}, '${s.name}')"
          class="${s.isLocked ? 'btn-success' : 'btn-danger'}" style="font-size:.75rem;">
          ${s.isLocked ? '🔓 Unlock' : '🔒 Lock'}
        </button>
      </td>
    </tr>`).join('');
}

async function toggleLock(id, lock, name) {
  const action = lock ? 'lock' : 'unlock';
  confirm2(
    (lock ? 'Lock' : 'Unlock') + ' Student',
    (lock ? 'Lock' : 'Unlock') + ' access for ' + name + '?',
    async () => {
      try {
        await apiFetch('/api/auth/admin/lock-student', { method: 'PATCH', body: JSON.stringify({ studentId: id, lock }) });
        showToast('Student ' + action + 'ed successfully', 'success');
        loadStudents(_studPage);
      } catch(e) {}
    },
    lock ? 'Lock Student' : 'Unlock Student'
  );
}

async function loadStudentsDropdown(elId) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  try {
    const data = await apiFetch('/api/auth/students?limit=200');
    sel.innerHTML = '<option value="">Select Student</option>';
    (data.data || []).forEach(s => { sel.innerHTML += '<option value="' + s._id + '">' + s.name + '</option>'; });
  } catch(e) {}
}

/* ── Teachers ───────────────────────────────────────────────────── */
let _allTeachers = [];

async function loadTeachers() {
  const tbody = document.getElementById('teachersTable');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    const data = await apiFetch('/api/teacher/all');
    _allTeachers = data.data || [];
    if (!_allTeachers.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 py-10">No teachers yet</td></tr>';
      return;
    }
    tbody.innerHTML = _allTeachers.map(t => `
      <tr>
        <td>
          <p class="font-medium text-gray-900">${t.name}</p>
          <span class="font-mono text-xs px-2 py-0.5 rounded" style="background:rgba(99,102,241,.08);color:#6366f1;">${t.inviteCode}</span>
        </td>
        <td><p class="text-sm text-gray-700">${t.email || '—'}</p><p class="text-xs text-gray-400">${t.mobile || '—'}</p></td>
        <td class="text-sm text-gray-600">${t.classTeacherOf?.name || '—'}</td>
        <td class="text-xs text-gray-400">${new Date(t.createdAt).toLocaleDateString()}</td>
        <td class="flex gap-2">
          <button onclick="openEditTeacherModal('${t._id}')" class="btn-icon" title="Edit">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteTeacher('${t._id}', '${t.name}')" class="btn-icon" title="Delete">
            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-400 py-8">Failed to load</td></tr>';
  }
}

function deleteTeacher(id, name) {
  confirm2('Delete Teacher', 'Delete ' + name + '? They will lose access immediately.', async () => {
    try {
      await apiFetch('/api/teacher/' + id, { method: 'DELETE' });
      showToast('Teacher deleted', 'success');
      loadTeachers();
    } catch(e) {}
  });
}

function genPassword() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  const pwd = Array.from({length:10}, () => c[Math.floor(Math.random()*c.length)]).join('');
  const el = document.getElementById('newStudentPwd');
  if (el) { el.value = pwd; el.style.borderColor = '#f97316'; setTimeout(() => el.style.borderColor = '', 1500); }
}

function genTeacherPassword() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  const pwd = Array.from({length:10}, () => c[Math.floor(Math.random()*c.length)]).join('');
  const el = document.getElementById('newTeacherPwd');
  if (el) { el.value = pwd; el.style.borderColor = '#6366f1'; setTimeout(() => el.style.borderColor = '', 1500); }
}

async function loadTeacherSessionsDropdown() {
  try {
    const data = await apiFetch('/api/sessions');
    const sel = document.getElementById('newTeacherSession');
    if (!sel) return;
    sel.innerHTML = '<option value="">None</option>';
    (data.data || []).forEach(s => { sel.innerHTML += '<option value="' + s._id + '">' + s.name + '</option>'; });
  } catch(e) {}
}

async function openEditTeacherModal(id) {
  const t = _allTeachers.find(x => x._id === id);
  if (!t) return;
  document.getElementById('editTeacherId').value = id;
  document.getElementById('editTeacherName').value = t.name;
  document.getElementById('editTeacherEmail').value = t.email || '';
  document.getElementById('editTeacherMobile').value = t.mobile || '';
  const data = await apiFetch('/api/sessions');
  const sel = document.getElementById('editTeacherSession');
  sel.innerHTML = '<option value="">None</option>';
  (data.data || []).forEach(s => { sel.innerHTML += '<option value="' + s._id + '">' + s.name + '</option>'; });
  sel.value = t.classTeacherOf ? (t.classTeacherOf._id || t.classTeacherOf) : '';
  document.getElementById('editTeacherModal').classList.remove('hidden');
}

function closeEditTeacherModal() {
  document.getElementById('editTeacherModal').classList.add('hidden');
}

document.getElementById('editTeacherForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editTeacherId').value;
  try {
    await apiFetch('/api/teacher/' + id, { method: 'PUT', body: JSON.stringify({
      name: document.getElementById('editTeacherName').value.trim(),
      email: document.getElementById('editTeacherEmail').value.trim(),
      mobile: document.getElementById('editTeacherMobile').value.trim(),
      sessionId: document.getElementById('editTeacherSession').value || null,
    })});
    showToast('Teacher updated!', 'success');
    closeEditTeacherModal();
    loadTeachers();
  } catch(e) {}
});

document.getElementById('createTeacherForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('createTeacherBtn');
  const og = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true;
  try {
    const data = await apiFetch('/api/teacher/create-teacher', { method: 'POST', body: JSON.stringify({
      name: document.getElementById('newTeacherName').value.trim(),
      email: document.getElementById('newTeacherEmail').value.trim(),
      mobile: document.getElementById('newTeacherMobile').value.trim(),
      sessionId: document.getElementById('newTeacherSession').value || undefined,
      password: document.getElementById('newTeacherPwd').value,
    })});
    showInviteModal(data.data.inviteCode, 'Teacher Created!', 'Share this code with the teacher to log in.');
    e.target.reset();
    loadTeachers();
  } catch(e) {} finally { btn.innerHTML = og; btn.disabled = false; }
});

/* ── Sessions ───────────────────────────────────────────────────── */
async function loadSessions() {
  const tbody = document.getElementById('sessionsTable');
  try {
    const data = await apiFetch('/api/sessions');
    const list = data.data || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-10">No classes yet</td></tr>';
    } else {
      tbody.innerHTML = list.map(s => `
        <tr>
          <td class="font-medium text-gray-900">${s.name}</td>
          <td><span class="font-mono text-xs px-2 py-1 rounded-lg" style="background:rgba(249,115,22,.08);color:#ea580c;">${s.sessionCode}</span></td>
          <td class="text-gray-600">${s.students?.length || 0}</td>
          <td class="text-xs text-gray-400">${new Date(s.createdAt).toLocaleDateString()}</td>
        </tr>`).join('');
    }
    const ops = list.map(s => '<option value="' + s._id + '">' + s.name + ' (' + s.sessionCode + ')</option>').join('');
    ['manageSessionId','ttAdminSession'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">Select Class</option>' + ops;
    });
    ['createStudentSession','bulkSessionSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">— No class —</option>' + ops;
    });
    const ns = document.getElementById('newTeacherSession');
    if (ns) { ns.innerHTML = '<option value="">None</option>' + ops; }
  } catch(e) {}
}

document.getElementById('createSessionForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const res = await apiFetch('/api/sessions/create', { method: 'POST', body: JSON.stringify({ name: document.getElementById('newSessionName').value.trim() }) });
    showToast('Class created! Code: ' + res.data.sessionCode, 'success');
    e.target.reset(); loadSessions();
  } catch(e) {}
});

document.getElementById('addStudentSessionForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const sessionId = document.getElementById('manageSessionId').value;
  const studentId = document.getElementById('manageStudentId').value;
  if (!sessionId || !studentId) return showToast('Select both class and student', 'error');
  try {
    await apiFetch('/api/sessions/add-students', { method: 'POST', body: JSON.stringify({ sessionId, studentIds: [studentId] }) });
    showToast('Student added to class!', 'success'); loadSessions();
  } catch(e) {}
});

/* ── Create Student ─────────────────────────────────────────────── */
document.getElementById('createStudentForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('createStudentBtn');
  const og = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> Creating…'; btn.disabled = true;
  try {
    const res = await apiFetch('/api/teacher/create-student', { method: 'POST', body: JSON.stringify({
      name: document.getElementById('newStudentName').value.trim(),
      email: document.getElementById('newStudentEmail').value.trim(),
      password: document.getElementById('newStudentPwd').value,
    })});
    const sessionId = document.getElementById('createStudentSession').value;
    if (sessionId && res.data._id) {
      try { await apiFetch('/api/sessions/add-students', { method: 'POST', body: JSON.stringify({ sessionId, studentIds: [res.data._id] }) }); } catch(e) {}
      document.getElementById('modalSessionNote').classList.remove('hidden');
    } else {
      document.getElementById('modalSessionNote').classList.add('hidden');
    }
    showInviteModal(res.data.inviteCode, 'Student Created!', 'Share this invite code with the student.');
    e.target.reset(); loadStudents(); loadDashboard();
  } catch(e) {} finally { btn.innerHTML = og; btn.disabled = false; }
});

/* ── Invite modal helper ─────────────────────────────────────────── */
function showInviteModal(code, title, sub) {
  document.getElementById('inviteModalTitle').textContent = title || 'Created!';
  document.getElementById('inviteModalSub').textContent = sub || '';
  document.getElementById('modalInviteCode').textContent = code;
  document.getElementById('inviteModal').classList.remove('hidden');
}

async function copyInviteCode() {
  const code = document.getElementById('modalInviteCode').textContent.trim();
  const btn = document.getElementById('copyCodeBtn');
  try {
    await navigator.clipboard.writeText(code);
    btn.innerHTML = '✓ Copied!';
    setTimeout(() => { btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Copy Code'; }, 2000);
  } catch(e) { showToast('Copy failed — copy manually', 'error'); }
}

/* ── Bulk CSV ───────────────────────────────────────────────────── */
function processCSV() {
  const file = document.getElementById('csvUploadInput').files[0];
  const sessionId = document.getElementById('bulkSessionSelect').value;
  if (!file) return showToast('Select a CSV file first', 'error');
  const btn = document.getElementById('bulkCreateBtn');
  const og = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> Importing…'; btn.disabled = true;
  const reader = new FileReader();
  reader.onload = async e => {
    const rows = e.target.result.split('\n').filter(r => r.trim());
    if (rows.length < 2) { btn.innerHTML = og; btn.disabled = false; return showToast('CSV empty', 'error'); }
    const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g,''));
    const ni = headers.indexOf('name'), ei = headers.indexOf('email'), pi = headers.indexOf('password');
    if (ni === -1 || pi === -1) { btn.innerHTML = og; btn.disabled = false; return showToast('CSV needs name and password columns', 'error'); }
    const students = rows.slice(1).map(r => { const c = r.split(',').map(x => x.trim().replace(/['"]/g,'')); return c[ni] && c[pi] ? { name:c[ni], email:ei!==-1?c[ei]:'', password:c[pi] } : null; }).filter(Boolean);
    if (!students.length) { btn.innerHTML = og; btn.disabled = false; return showToast('No valid rows found', 'error'); }
    try {
      const payload = { students }; if (sessionId) payload.sessionId = sessionId;
      const res = await apiFetch('/api/teacher/bulk-create-student', { method: 'POST', body: JSON.stringify(payload) });
      const csv = 'Name,Email,InviteCode\n' + res.data.map(s => s.name + ',' + (s.email||'') + ',' + s.inviteCode).join('\n');
      const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
      a.download = 'student_codes.csv'; document.body.appendChild(a); a.click(); a.remove();
      showToast('Imported ' + res.count + ' students!', 'success'); loadStudents(); loadDashboard();
    } catch(e) {} finally { btn.innerHTML = og; btn.disabled = false; }
  };
  reader.readAsText(file);
}

/* ── Attendance ─────────────────────────────────────────────────── */
async function loadAdminAttendance(page) {
  page = page || 1;
  const tbody = document.getElementById('attendanceTable');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    const data = await apiFetch('/api/attendance?page=' + page + '&limit=30');
    if (!data.data?.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 py-10">No records</td></tr>'; return; }
    tbody.innerHTML = data.data.map(a => `
      <tr>
        <td class="font-medium">${a.studentId?.name || '—'}</td>
        <td>${a.subject}</td>
        <td class="text-gray-500 text-xs">${new Date(a.date).toLocaleDateString()}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td class="text-gray-500">${a.markedBy?.name || '—'}</td>
      </tr>`).join('');
    if (data.pagination) renderPagination('attendancePagination', data.pagination.page, data.pagination.totalPages, 'loadAdminAttendance');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

/* ── Marks ──────────────────────────────────────────────────────── */
async function loadAdminMarks(page) {
  page = page || 1;
  const tbody = document.getElementById('marksTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    const data = await apiFetch('/api/marks?page=' + page + '&limit=30');
    if (!data.data?.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-10">No records</td></tr>'; return; }
    tbody.innerHTML = data.data.map(m => `
      <tr>
        <td class="font-medium">${m.studentId?.name || '—'}</td>
        <td>${m.subject}</td>
        <td class="capitalize text-gray-500">${m.examType}</td>
        <td>${m.marks}</td>
        <td class="text-gray-500">${m.totalMarks}</td>
        <td><span class="badge badge-${m.grade==='F'?'absent':m.grade==='A+'||m.grade==='A'?'present':'late'}">${m.grade}</span></td>
      </tr>`).join('');
    if (data.pagination) renderPagination('marksPagination', data.pagination.page, data.pagination.totalPages, 'loadAdminMarks');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

/* ── Fees ───────────────────────────────────────────────────────── */
async function loadFeesAdmin(page) {
  page = page || 1;
  const status = document.getElementById('feeStatusFilter')?.value || '';
  const tbody = document.getElementById('feesTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    let url = '/api/fees?page=' + page + '&limit=30';
    if (status) url += '&status=' + status;
    const data = await apiFetch(url);
    if (!data.data?.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-10">No fee records</td></tr>'; return; }
    tbody.innerHTML = data.data.map(f => `
      <tr>
        <td class="font-medium">${f.studentId?.name || '—'}</td>
        <td class="capitalize text-gray-600">${f.feeType}</td>
        <td class="font-medium">₹${f.amount.toLocaleString()}</td>
        <td><span class="badge badge-${f.status}">${f.status}</span></td>
        <td class="text-xs text-gray-400">${new Date(f.dueDate).toLocaleDateString()}</td>
        <td>
          ${f.status !== 'paid'
            ? '<button onclick="markPaid(\''+f._id+'\')" class="btn-success" style="font-size:.75rem;">Mark Paid</button>'
            : '<span class="text-xs text-gray-400">Paid ✓</span>'}
        </td>
      </tr>`).join('');
    if (data.pagination) renderPagination('feesPagination', data.pagination.page, data.pagination.totalPages, 'loadFeesAdmin');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

async function markPaid(feeId) {
  try {
    await apiFetch('/api/fees/pay', { method: 'POST', body: JSON.stringify({ feeId }) });
    showToast('Fee marked as paid!', 'success'); loadFeesAdmin(); loadDashboard();
  } catch(e) {}
}

document.getElementById('addFeeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    studentId: document.getElementById('feeStudentId').value,
    feeType: document.getElementById('feeType').value,
    amount: Number(document.getElementById('feeAmount').value),
    dueDate: document.getElementById('feeDueDate').value,
    description: document.getElementById('feeDescription').value,
  };
  if (!payload.studentId || !payload.amount || !payload.dueDate) return showToast('Fill all required fields', 'error');
  try {
    await apiFetch('/api/fees/add', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Fee record added!', 'success'); e.target.reset(); loadFeesAdmin();
  } catch(e) {}
});

/* ── Discipline ─────────────────────────────────────────────────── */
let _currentDiscId = null;

async function loadAdminDiscipline() {
  const tbody = document.getElementById('adminDisciplineTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8"><span class="spin"></span></td></tr>';
  const severity = document.getElementById('discSeverityFilter')?.value || '';
  const action = document.getElementById('discActionFilter')?.value || '';
  try {
    let url = '/api/discipline?limit=50';
    if (severity) url += '&severity=' + severity;
    if (action) url += '&action=' + action;
    const data = await apiFetch(url);
    if (!data.data?.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-10">No cases reported</td></tr>'; return; }
    const sevBadge = { low:'badge-low', medium:'badge-medium', high:'badge-high' };
    const actLabel = { pending:'<span class="badge badge-pending">Pending</span>', warning:'<span class="badge badge-late">Warning</span>', suspend:'<span class="badge badge-absent">Suspended</span>', notify_parent:'<span class="badge badge-present">Parent Notified</span>', resolved:'<span class="badge badge-present">Resolved</span>' };
    tbody.innerHTML = data.data.map(d => `
      <tr>
        <td class="font-medium">${d.student?.name || '—'}</td>
        <td class="text-gray-500">${d.reportedBy?.name || '—'}</td>
        <td class="max-w-xs" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.reason}">${d.reason}</td>
        <td><span class="badge ${sevBadge[d.severity]||'badge-late'}">${d.severity}</span></td>
        <td class="text-xs text-gray-400">${new Date(d.date).toLocaleDateString()}</td>
        <td>${actLabel[d.action] || d.action}</td>
        <td>
          ${d.action === 'pending' || d.action === 'warning'
            ? '<button onclick="openDisciplineAction(\''+d._id+'\',\''+( d.student?.name||'')+'\''+')" class="btn-primary" style="font-size:.75rem;padding:.35rem .75rem;">Take Action</button>'
            : '<span class="text-xs text-gray-400">' + (d.actionNote || '—') + '</span>'}
        </td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

function openDisciplineAction(id, name) {
  _currentDiscId = id;
  document.getElementById('discActionStudentName').textContent = 'Student: ' + name;
  document.getElementById('discActionNote').value = '';
  document.getElementById('disciplineActionModal').classList.remove('hidden');
}

async function submitDisciplineAction() {
  if (!_currentDiscId) return;
  try {
    await apiFetch('/api/discipline/' + _currentDiscId + '/action', { method: 'PATCH', body: JSON.stringify({
      action: document.getElementById('discActionType').value,
      actionNote: document.getElementById('discActionNote').value.trim(),
    })});
    showToast('Action recorded!', 'success');
    document.getElementById('disciplineActionModal').classList.add('hidden');
    _currentDiscId = null; loadAdminDiscipline();
  } catch(e) {}
}

/* ── Notices ────────────────────────────────────────────────────── */
async function loadAdminNotices() {
  const c = document.getElementById('adminNoticeList');
  c.innerHTML = '<p class="text-center text-gray-400 py-8"><span class="spin"></span></p>';
  try {
    const data = await apiFetch('/api/notices');
    if (!data.data?.length) { c.innerHTML = '<p class="text-center text-gray-400 py-8">No notices yet</p>'; return; }
    c.innerHTML = data.data.map(n => `
      <div class="card p-4 flex items-start justify-between gap-4">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900">${n.title}</h4>
          <p class="text-sm text-gray-500 mt-1">${n.body}</p>
          <p class="text-xs text-gray-400 mt-2">${n.postedBy?.name || '—'} · ${new Date(n.createdAt).toLocaleDateString()} · <span class="capitalize" style="color:#f97316;">${n.audience}</span></p>
        </div>
        <button onclick="deleteNotice('${n._id}')" class="btn-icon flex-shrink-0" title="Delete">
          <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>`).join('');
  } catch(e) { c.innerHTML = '<p class="text-center text-red-400 py-8">Failed to load</p>'; }
}

async function deleteNotice(id) {
  confirm2('Delete Notice', 'Remove this notice?', async () => {
    try { await apiFetch('/api/notices/' + id, { method: 'DELETE' }); showToast('Notice deleted', 'success'); loadAdminNotices(); } catch(e) {}
  });
}

document.getElementById('adminNoticeForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await apiFetch('/api/notices', { method: 'POST', body: JSON.stringify({
      title: document.getElementById('noticeTitle').value,
      body: document.getElementById('noticeBody').value,
      audience: document.getElementById('noticeAudience').value,
    })});
    showToast('Notice posted!', 'success'); e.target.reset(); loadAdminNotices();
  } catch(e) {}
});

/* ── Timetable ──────────────────────────────────────────────────── */
async function loadAdminTimetable() {
  try {
    const data = await apiFetch('/api/sessions');
    const sel = document.getElementById('ttAdminSession');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Class</option>';
    (data.data || []).forEach(s => { sel.innerHTML += '<option value="' + s._id + '">' + s.name + ' (' + s.sessionCode + ')</option>'; });
  } catch(e) {}
}

document.getElementById('ttAdminSession')?.addEventListener('change', function() { if (this.value) loadTimetableView(this.value); });

document.getElementById('adminTimetableForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const sessionId = document.getElementById('ttAdminSession').value;
  if (!sessionId) return showToast('Select a class', 'error');
  try {
    await apiFetch('/api/timetable', { method: 'POST', body: JSON.stringify({
      sessionId, dayOfWeek: document.getElementById('ttDay').value,
      subject: document.getElementById('ttSubject').value,
      startTime: document.getElementById('ttStart').value,
      endTime: document.getElementById('ttEnd').value,
      teacher: document.getElementById('ttTeacher').value,
    })});
    showToast('Entry added!', 'success'); e.target.reset(); loadTimetableView(sessionId);
  } catch(e) {}
});

async function loadTimetableView(sessionId) {
  const c = document.getElementById('adminTimetableList');
  try {
    const data = await apiFetch('/api/timetable/' + sessionId);
    if (!data.data?.length) { c.innerHTML = '<p class="text-center text-gray-400 py-8">No entries yet</p>'; return; }
    c.innerHTML = '<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Action</th></tr></thead><tbody>' +
      data.data.map(e => '<tr><td>' + e.dayOfWeek + '</td><td class="font-mono text-xs">' + e.startTime + ' – ' + e.endTime + '</td><td>' + e.subject + '</td><td class="text-gray-500">' + (e.teacher||'—') + '</td><td><button onclick="deleteTTEntry(\''+e._id+'\',\''+sessionId+'\')" class="btn-danger" style="font-size:.72rem;">Delete</button></td></tr>').join('') +
      '</tbody></table></div></div>';
  } catch(e) {}
}

async function deleteTTEntry(id, sessionId) {
  confirm2('Delete Entry', 'Remove this timetable entry?', async () => {
    try { await apiFetch('/api/timetable/' + id, { method: 'DELETE' }); showToast('Deleted', 'success'); loadTimetableView(sessionId); } catch(e) {}
  });
}

/* ── Leave Requests ─────────────────────────────────────────────── */
async function loadAdminLeaves() {
  const tbody = document.getElementById('adminLeaveTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="spin"></span></td></tr>';
  try {
    const data = await apiFetch('/api/leaves');
    if (!data.data?.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-10">No leave requests</td></tr>'; return; }
    tbody.innerHTML = data.data.map(l => `
      <tr>
        <td class="font-medium">${l.student?.name || '—'}</td>
        <td class="text-sm text-gray-500" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.reason}</td>
        <td class="text-xs text-gray-400">${new Date(l.fromDate).toLocaleDateString()}</td>
        <td class="text-xs text-gray-400">${new Date(l.toDate).toLocaleDateString()}</td>
        <td><span class="badge badge-${l.status==='approved'?'present':l.status==='rejected'?'absent':'pending'}">${l.status}</span></td>
        <td>
          ${l.status === 'pending'
            ? '<button onclick="reviewLeave(\''+l._id+'\',\'approved\')" class="btn-success mr-1" style="font-size:.72rem;">Approve</button><button onclick="reviewLeave(\''+l._id+'\',\'rejected\')" class="btn-danger" style="font-size:.72rem;">Reject</button>'
            : '<span class="text-xs text-gray-400">Reviewed</span>'}
        </td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

async function reviewLeave(id, status) {
  try {
    await apiFetch('/api/leaves/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
    showToast('Leave ' + status + '!', 'success'); loadAdminLeaves();
  } catch(e) {}
}

/* ── Boot ───────────────────────────────────────────────────────── */
loadDashboard();
