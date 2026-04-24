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
  timetablemgr:'Timetable', leavemgr:'Leave Requests', classrequests:'Class Requests',
  assignments:'Assignments', reports:'Reports', bulkpwd:'Bulk Password',
  auditlog:'Audit Log', settings:'Settings', holidays:'Holidays'
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
  var _bc = document.getElementById('bcCurrent');
  if (_bc) _bc.textContent = _secNames[name] || name;
  closeSidebar();
  if (name === 'students')    { loadStudents(); loadSessions(); }
  if (name === 'teachers')    { loadTeachers(); loadTeacherSessionsDropdown(); }
  if (name === 'sessions')    { loadSessions(); loadStudentsDropdown('manageStudentId'); }
  if (name === 'attendance')  loadAdminAttendance();
  if (name === 'marks')       loadAdminMarks();
  if (name === 'fees')        { loadFeesAdmin(); loadStudentsDropdown('feeStudentId'); }
  if (name === 'discipline')  loadAdminDiscipline();
  if (name === 'notices')     loadAdminNotices();
  if (name === 'timetablemgr'){ loadAdminTimetable(); }
  if (name === 'leavemgr')    loadAdminLeaves();
  if (name === 'holidays')    loadHolidays();
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
    loadDashboardExtras(data);
  } catch(e) { console.error('Dashboard stats failed:', e); }
}

/* ── Students ───────────────────────────────────────────────────── */
let _allStudents = [], _studPage = 1;
let _selectedStudents = new Set();

async function loadStudents(page) {
  page = page || 1; _studPage = page;
  const search = document.getElementById('studentSearch')?.value || '';
  const status = document.getElementById('studentStatusFilter')?.value || '';
  const tbody = document.getElementById('studentsTable');
  tbody.innerHTML = skeletonRows(7);
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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-400 py-8">Failed to load students</td></tr>';
  }
}

function filterStudents(q) { loadStudents(1); }

function renderStudentsTable(list) {
  const tbody = document.getElementById('studentsTable');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-16">
      <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(249,115,22,.08);display:flex;align-items:center;justify-content:center;">
          <svg width="28" height="28" fill="none" stroke="#f97316" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
        </div>
        <p style="color:#9ca3af;font-size:.88rem;">No students found</p>
        <button onclick="document.getElementById('newStudentName')?.focus()" class="btn-primary" style="font-size:.8rem;padding:.45rem 1rem;">+ Add First Student</button>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td><input type="checkbox" class="student-cb" value="${s._id}" onchange="toggleStudentCb(this)" style="cursor:pointer;accent-color:#f97316;" ${_selectedStudents.has(s._id) ? 'checked' : ''}></td>
      <td><span class="font-medium text-gray-900">${s.name}</span></td>
      <td><span class="font-mono text-xs px-2 py-1 rounded-lg" style="background:rgba(249,115,22,.08);color:#ea580c;">${s.inviteCode || '—'}</span></td>
      <td class="text-gray-500">${s.email || '—'}</td>
      <td>${s.isLocked
        ? '<span class="badge badge-absent">🔒 Locked</span>'
        : '<span class="badge badge-present">✓ Active</span>'}</td>
      <td class="text-gray-400 text-xs">${new Date(s.createdAt).toLocaleDateString()}</td>
      <td>
        <div class="flex gap-1">
          <button onclick="openEditStudentModal('${s._id}')" class="btn-icon" title="Edit student">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="toggleLock('${s._id}', ${!s.isLocked}, '${s.name}')"
            class="${s.isLocked ? 'btn-success' : 'btn-danger'}" style="font-size:.75rem;">
            ${s.isLocked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
        </div>
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
      } catch(e) { /* apiFetch already showed toast */ }
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
    } catch(e) { /* apiFetch already showed toast */ }
  });
}

function genPassword() {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#!';
  // Bug 1.26: guarantee at least one of each required character class
  const base = Array.from({length:6}, () => (upper+lower+digits+special)[Math.floor(Math.random()*(upper+lower+digits+special).length)]);
  const required = [
    upper[Math.floor(Math.random()*upper.length)],
    digits[Math.floor(Math.random()*digits.length)],
    special[Math.floor(Math.random()*special.length)],
    lower[Math.floor(Math.random()*lower.length)],
  ];
  // Shuffle all 10 chars together
  const all = base.concat(required).sort(() => Math.random() - 0.5);
  const pwd = all.join('');
  const el = document.getElementById('newStudentPwd');
  if (el) { el.value = pwd; el.style.borderColor = '#f97316'; setTimeout(() => el.style.borderColor = '', 1500); }
}

function genTeacherPassword() {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#!';
  // Bug 1.26: guarantee at least one of each required character class
  const base = Array.from({length:6}, () => (upper+lower+digits+special)[Math.floor(Math.random()*(upper+lower+digits+special).length)]);
  const required = [
    upper[Math.floor(Math.random()*upper.length)],
    digits[Math.floor(Math.random()*digits.length)],
    special[Math.floor(Math.random()*special.length)],
    lower[Math.floor(Math.random()*lower.length)],
  ];
  const all = base.concat(required).sort(() => Math.random() - 0.5);
  const pwd = all.join('');
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
    ['createStudentSession','bulkSessionSelect','multiAddSession'].forEach(id => {
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

/* ── Multi-Student Quick Add ────────────────────────────────────── */
let _multiAddCounter = 0;
let _multiAddResults = [];

function _generatePwd() {
  var upper='ABCDEFGHJKMNPQRSTUVWXYZ',lower='abcdefghjkmnpqrstuvwxyz',digits='23456789',special='@#!';
  var pool=upper+lower+digits+special;
  var base=Array.from({length:6},function(){return pool[Math.floor(Math.random()*pool.length)]});
  var req=[upper[Math.floor(Math.random()*upper.length)],digits[Math.floor(Math.random()*digits.length)],special[Math.floor(Math.random()*special.length)],lower[Math.floor(Math.random()*lower.length)]];
  return base.concat(req).sort(function(){return Math.random()-0.5}).join('');
}

function multiAddRow() {
  _multiAddCounter++;
  var tbody = document.getElementById('multiAddBody');
  var tr = document.createElement('tr');
  tr.id = 'maRow' + _multiAddCounter;
  tr.innerHTML = '<td class="text-center text-xs text-gray-400">' + _multiAddCounter + '</td>' +
    '<td><input type="text" class="inp ma-name" placeholder="e.g. Ahmed Khan" style="min-width:140px;"/></td>' +
    '<td><input type="email" class="inp ma-email" placeholder="email (optional)" style="min-width:140px;"/></td>' +
    '<td><input type="text" class="inp ma-mobile" placeholder="phone (optional)" style="min-width:140px;"/></td>' +
    '<td><input type="text" class="inp ma-pwd" value="' + _generatePwd() + '" style="min-width:120px;font-family:monospace;font-size:.78rem;"/></td>' +
    '<td><button type="button" onclick="this.closest(\'tr\').remove();multiReindex()" class="btn-icon" title="Remove"><svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></td>';
  tbody.appendChild(tr);
  // Focus the name field
  tr.querySelector('.ma-name').focus();
}

function multiReindex() {
  var rows = document.querySelectorAll('#multiAddBody tr');
  rows.forEach(function(row, i) {
    row.querySelector('td').textContent = i + 1;
  });
}

function multiAddGenAllPwd() {
  document.querySelectorAll('#multiAddBody .ma-pwd').forEach(function(inp) {
    inp.value = _generatePwd();
    inp.style.borderColor = '#f97316';
    setTimeout(function(){ inp.style.borderColor = ''; }, 1200);
  });
  showToast('All passwords regenerated!', 'success');
}

async function multiCreateAll() {
  var rows = document.querySelectorAll('#multiAddBody tr');
  if (!rows.length) return showToast('Add at least one student row first', 'error');

  var students = [];
  var passwords = {};
  var hasError = false;

  rows.forEach(function(row) {
    var name = row.querySelector('.ma-name').value.trim();
    var email = row.querySelector('.ma-email').value.trim();
    var mobile = row.querySelector('.ma-mobile').value.trim();
    var pwd = row.querySelector('.ma-pwd').value;
    if (!name) { row.querySelector('.ma-name').style.borderColor = '#ef4444'; hasError = true; return; }
    if (!pwd || pwd.length < 6) { row.querySelector('.ma-pwd').style.borderColor = '#ef4444'; hasError = true; return; }
    row.querySelector('.ma-name').style.borderColor = '';
    row.querySelector('.ma-pwd').style.borderColor = '';
    students.push({ name: name, email: email, mobile: mobile, password: pwd });
    passwords[name + '||' + email] = pwd;
  });

  if (hasError) return showToast('Fill in all required fields (name + password)', 'error');
  if (!students.length) return showToast('No valid students to create', 'error');

  var btn = document.getElementById('multiCreateBtn');
  var og = btn.innerHTML;
  btn.innerHTML = '<span class="spin"></span> Creating ' + students.length + ' students…';
  btn.disabled = true;

  try {
    var payload = { students: students };
    var sessionId = document.getElementById('multiAddSession').value;
    if (sessionId) payload.sessionId = sessionId;
    var res = await apiFetch('/api/teacher/bulk-create-student', { method: 'POST', body: JSON.stringify(payload) });

    // Show results
    _multiAddResults = (res.data || []).map(function(s) {
      var key = s.name + '||' + (s.email || '');
      return { name: s.name, email: s.email || '', inviteCode: s.inviteCode, password: passwords[key] || '—' };
    });

    var rtbody = document.getElementById('multiAddResultsBody');
    rtbody.innerHTML = _multiAddResults.map(function(s) {
      return '<tr>' +
        '<td class="font-medium text-gray-900">' + s.name + '</td>' +
        '<td class="text-gray-500">' + (s.email || '—') + '</td>' +
        '<td><span class="font-mono text-xs px-2 py-1 rounded-lg" style="background:rgba(249,115,22,.08);color:#ea580c;">' + s.inviteCode + '</span></td>' +
        '<td><span class="font-mono text-xs text-gray-500">' + s.password + '</span></td>' +
        '</tr>';
    }).join('');

    document.getElementById('multiAddResults').classList.remove('hidden');
    showToast('Created ' + (res.count || _multiAddResults.length) + ' students! Invite codes are shown below.', 'success');

    // Clear the input rows and reset
    document.getElementById('multiAddBody').innerHTML = '';
    _multiAddCounter = 0;
    // Refresh lists
    loadStudents(); loadDashboard();
  } catch(e) {} finally {
    btn.innerHTML = og; btn.disabled = false;
  }
}

function downloadMultiCodes() {
  if (!_multiAddResults.length) return showToast('No results to download', 'error');
  var csv = 'Name,Email,InviteCode,Password\n' + _multiAddResults.map(function(s) {
    return '"' + s.name + '","' + s.email + '","' + s.inviteCode + '","' + s.password + '"';
  }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'student_invite_codes.csv';
  a.click();
  showToast('Downloaded ' + _multiAddResults.length + ' student codes!', 'success');
}

// Initialize with 3 rows on first load
(function() {
  var initMultiAdd = function() {
    if (document.getElementById('multiAddBody') && !document.getElementById('multiAddBody').children.length) {
      multiAddRow(); multiAddRow(); multiAddRow();
    }
  };
  // Run now and also when students section is shown
  setTimeout(initMultiAdd, 500);
  var origShow = window.showSection;
  var multiPatched = false;
  if (!multiPatched) {
    multiPatched = true;
    window.showSection = function(name, el) {
      origShow(name, el);
      if (name === 'students') initMultiAdd();
    };
  }
})();

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
          <div class="flex gap-1 items-center">
            ${f.status !== 'paid'
              ? '<button onclick="markPaid(\''+f._id+'\')" class="btn-success" style="font-size:.75rem;">Mark Paid</button>'
              : '<span class="text-xs text-gray-400">Paid ✓</span>'}
            ${f.studentId?.mobile ? `<button onclick="sendWhatsAppMessage('${f.studentId.mobile}', '${f.studentId.name}', 'fee', ${f.amount})" class="btn-icon text-green-500 hover:bg-green-50 ml-1" title="Send WhatsApp Reminder">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.39 0 0 5.392 0 12.035c0 2.122.551 4.195 1.6 6.023L.085 24l6.115-1.603c1.766.953 3.766 1.455 5.83 1.455 6.64 0 12.033-5.392 12.033-12.036S18.672 0 12.031 0zm0 21.853c-1.802 0-3.568-.484-5.114-1.402l-.367-.217-3.8.997 1.018-3.7-.238-.38c-1.006-1.597-1.537-3.447-1.537-5.358 0-5.545 4.512-10.057 10.06-10.057 5.544 0 10.058 4.512 10.058 10.058 0 5.545-4.514 10.059-10.058 10.059zm5.526-7.55c-.303-.153-1.792-.885-2.071-.986-.278-.103-.482-.153-.684.153-.203.305-.783.987-.96 1.19-.176.202-.353.228-.656.076-.303-.153-1.28-.472-2.44-1.503-.902-.803-1.51-1.796-1.688-2.102-.178-.306-.02-.472.133-.623.136-.136.303-.356.455-.535.152-.18.203-.306.303-.51.102-.204.05-.382-.025-.536-.076-.153-.684-1.648-.937-2.256-.247-.59-.498-.51-.684-.52-.177-.008-.38-.01-.583-.01-.203 0-.533.076-.81.382-.278.305-1.06 1.04-1.06 2.535 0 1.496 1.087 2.94 1.238 3.143.153.204 2.146 3.275 5.197 4.593 2.553 1.103 3.324.962 3.91.808.776-.205 2.455-1.002 2.798-1.968.344-.966.344-1.796.242-1.968-.103-.172-.38-.275-.684-.428z"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
    if (data.pagination) renderPagination('feesPagination', data.pagination.page, data.pagination.totalPages, 'loadFeesAdmin');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red-400 py-8">Failed to load</td></tr>'; }
}

async function markPaid(feeId) {
  try {
    await apiFetch('/api/fees/pay', { method: 'POST', body: JSON.stringify({ feeId }) });
    showToast('Fee marked as paid!', 'success'); loadFeesAdmin(); loadDashboard();
  } catch(e) { /* apiFetch already showed toast; no UI state to restore */ }
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
  } catch(e) { /* apiFetch already showed toast */ }
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
          <div class="flex gap-1 items-center">
            ${d.action === 'pending' || d.action === 'warning'
              ? '<button onclick="openDisciplineAction(\''+d._id+'\',\''+( d.student?.name||'')+'\''+')" class="btn-primary" style="font-size:.75rem;padding:.35rem .75rem;">Take Action</button>'
              : '<span class="text-xs text-gray-400">' + (d.actionNote || '—') + '</span>'}
            ${d.student?.mobile ? `<button onclick="sendWhatsAppMessage('${d.student.mobile}', '${d.student.name}', 'discipline')" class="btn-icon text-green-500 hover:bg-green-50 ml-1" title="Send WhatsApp Notice">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.39 0 0 5.392 0 12.035c0 2.122.551 4.195 1.6 6.023L.085 24l6.115-1.603c1.766.953 3.766 1.455 5.83 1.455 6.64 0 12.033-5.392 12.033-12.036S18.672 0 12.031 0zm0 21.853c-1.802 0-3.568-.484-5.114-1.402l-.367-.217-3.8.997 1.018-3.7-.238-.38c-1.006-1.597-1.537-3.447-1.537-5.358 0-5.545 4.512-10.057 10.06-10.057 5.544 0 10.058 4.512 10.058 10.058 0 5.545-4.514 10.059-10.058 10.059zm5.526-7.55c-.303-.153-1.792-.885-2.071-.986-.278-.103-.482-.153-.684.153-.203.305-.783.987-.96 1.19-.176.202-.353.228-.656.076-.303-.153-1.28-.472-2.44-1.503-.902-.803-1.51-1.796-1.688-2.102-.178-.306-.02-.472.133-.623.136-.136.303-.356.455-.535.152-.18.203-.306.303-.51.102-.204.05-.382-.025-.536-.076-.153-.684-1.648-.937-2.256-.247-.59-.498-.51-.684-.52-.177-.008-.38-.01-.583-.01-.203 0-.533.076-.81.382-.278.305-1.06 1.04-1.06 2.535 0 1.496 1.087 2.94 1.238 3.143.153.204 2.146 3.275 5.197 4.593 2.553 1.103 3.324.962 3.91.808.776-.205 2.455-1.002 2.798-1.968.344-.966.344-1.796.242-1.968-.103-.172-.38-.275-.684-.428z"/></svg>
            </button>` : ''}
          </div>
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
  const btn = document.getElementById('discActionSubmitBtn');
  const og = btn ? btn.innerHTML : null;
  if (btn) { btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true; }
  try {
    await apiFetch('/api/discipline/' + _currentDiscId + '/action', { method: 'PATCH', body: JSON.stringify({
      action: document.getElementById('discActionType').value,
      actionNote: document.getElementById('discActionNote').value.trim(),
    })});
    showToast('Action recorded!', 'success');
    document.getElementById('disciplineActionModal').classList.add('hidden');
    _currentDiscId = null; loadAdminDiscipline();
  } catch(e) {
    // Bug 1.28: restore button state so user can retry
    if (btn) { btn.innerHTML = og; btn.disabled = false; }
  }
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

/* ── Timetable Builder ──────────────────────────────────────────── */
// Loads sessions into the picker and teacher dropdown
async function loadAdminTimetable() {
  try {
    const [sessData, teachData] = await Promise.all([
      apiFetch('/api/sessions'),
      apiFetch('/api/teacher/all'),
    ]);
    // Session picker
    const sel = document.getElementById('ttAdminSession');
    if (sel) {
      sel.innerHTML = '<option value="">— Choose a class —</option>';
      (sessData.data || []).forEach(s => {
        sel.innerHTML += `<option value="${s._id}">${s.name} (${s.sessionCode})</option>`;
      });
    }
    // Teacher dropdown
    const tsel = document.getElementById('ttTeacher');
    if (tsel) {
      tsel.innerHTML = '<option value="">— None —</option>';
      (teachData.data || []).forEach(t => {
        tsel.innerHTML += `<option value="${t.name}">${t.name}</option>`;
      });
    }
  } catch(e) {}
}

// Called when admin picks a session — shows the builder and loads existing entries
async function loadTimetableBuilder() {
  const sessionId = document.getElementById('ttAdminSession').value;
  const builder = document.getElementById('ttBuilder');
  if (!sessionId) { builder.classList.add('hidden'); return; }
  builder.classList.remove('hidden');
  await renderWeekGrid(sessionId);
}

// Renders the full weekly grid for a session
async function renderWeekGrid(sessionId) {
  const grid = document.getElementById('ttWeekGrid');
  grid.innerHTML = '<p class="text-center text-gray-400 py-6"><span class="spin"></span></p>';
  try {
    const data = await apiFetch('/api/timetable/' + sessionId);
    const entries = data.data || [];
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const grouped = {};
    days.forEach(d => grouped[d] = []);
    entries.forEach(e => { if (grouped[e.dayOfWeek]) grouped[e.dayOfWeek].push(e); });

    const activeDays = days.filter(d => grouped[d].length > 0);
    if (!activeDays.length) {
      grid.innerHTML = '<p class="text-center text-gray-400 py-8 text-sm">No periods yet. Add one above.</p>';
      return;
    }

    grid.innerHTML = activeDays.map(day => `
      <div class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h4 class="font-semibold text-gray-800 text-sm">${day}</h4>
          <span class="text-xs text-gray-400">${grouped[day].length} period${grouped[day].length !== 1 ? 's' : ''}</span>
        </div>
        <div class="divide-y divide-gray-50">
          ${grouped[day].map(e => `
            <div class="flex items-center gap-4 px-5 py-3">
              <span class="font-mono text-xs text-indigo-600 w-28 shrink-0">${e.startTime} – ${e.endTime}</span>
              <div class="flex-1">
                <p class="font-medium text-gray-900 text-sm">${e.subject}</p>
                ${e.teacher ? `<p class="text-xs text-gray-400">👤 ${e.teacher}</p>` : ''}
              </div>
              <button onclick="deleteTTEntry('${e._id}','${sessionId}')"
                class="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50">
                ✕ Remove
              </button>
            </div>`).join('')}
        </div>
      </div>`).join('');
  } catch(e) {
    grid.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Failed to load</p>';
  }
}

// Add a single period
async function addTimetableRow() {
  const sessionId = document.getElementById('ttAdminSession').value;
  const subject   = document.getElementById('ttSubject').value.trim();
  const startTime = document.getElementById('ttStart').value;
  const endTime   = document.getElementById('ttEnd').value;
  const dayOfWeek = document.getElementById('ttDay').value;
  const teacher   = document.getElementById('ttTeacher').value;

  if (!sessionId) return showToast('Select a class first', 'error');
  if (!subject)   return showToast('Enter a subject', 'error');
  if (!startTime || !endTime) return showToast('Enter start and end time', 'error');

  try {
    await apiFetch('/api/timetable', { method: 'POST', body: JSON.stringify({ sessionId, dayOfWeek, subject, startTime, endTime, teacher }) });
    showToast(subject + ' added to ' + dayOfWeek, 'success');
    // Clear subject/time fields but keep day/teacher for quick repeat entry
    document.getElementById('ttSubject').value = '';
    document.getElementById('ttStart').value = '';
    document.getElementById('ttEnd').value = '';
    await renderWeekGrid(sessionId);
  } catch(e) {}
}

async function deleteTTEntry(id, sessionId) {
  confirm2('Remove Period', 'Remove this period from the timetable?', async () => {
    try {
      await apiFetch('/api/timetable/' + id, { method: 'DELETE' });
      showToast('Period removed', 'success');
      renderWeekGrid(sessionId);
    } catch(e) {}
  }, 'Remove');
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

/* ── Command Palette ──────────────────────────────────────────────────────── */
const _cmdItems = [
  { label: 'Dashboard', section: 'dashboard', icon: '📊', hint: 'Ctrl+1' },
  { label: 'Students', section: 'students', icon: '👤', hint: 'Ctrl+2' },
  { label: 'Teachers', section: 'teachers', icon: '👥', hint: 'Ctrl+3' },
  { label: 'Classes', section: 'sessions', icon: '🏫', hint: 'Ctrl+4' },
  { label: 'Fees', section: 'fees', icon: '💰', hint: 'Ctrl+5' },
  { label: 'Attendance', section: 'attendance', icon: '📋' },
  { label: 'Marks', section: 'marks', icon: '📈' },
  { label: 'Discipline', section: 'discipline', icon: '⚠️' },
  { label: 'Notices', section: 'notices', icon: '📢' },
  { label: 'Timetable', section: 'timetablemgr', icon: '📅' },
  { label: 'Leave Requests', section: 'leavemgr', icon: '📝' },
  { label: 'Class Requests', section: 'classrequests', icon: '➕' },
  { label: 'Assignments', section: 'assignments', icon: '📓' },
  { label: 'Reports', section: 'reports', icon: '📉' },
  { label: 'Bulk Password', section: 'bulkpwd', icon: '🔑' },
  { label: 'Audit Log', section: 'auditlog', icon: '📄' },
  { label: 'Settings', section: 'settings', icon: '⚙️' },
  { type: 'divider', label: 'Quick Actions' },
  { label: 'Create Student', action: function(){ showSection('students',document.querySelector('[onclick*="students"]')); setTimeout(function(){ var el=document.getElementById('newStudentName'); if(el) el.focus(); },300); }, icon: '➕' },
  { label: 'Create Teacher', action: function(){ showSection('teachers',document.querySelector('[onclick*="teachers"]')); setTimeout(function(){ var el=document.getElementById('newTeacherName'); if(el) el.focus(); },300); }, icon: '➕' },
  { label: 'Post Notice', action: function(){ showSection('notices',document.querySelector('[onclick*="notices"]')); setTimeout(function(){ var el=document.getElementById('noticeTitle'); if(el) el.focus(); },300); }, icon: '📢' },
  { label: 'Export Students CSV', action: function(){ exportReportCSV(); }, icon: '📥' },
  { label: 'Logout', action: function(){ logout(); }, icon: '🚪' },
];

let _cmdActiveIdx = 0;

function openCmdPalette() {
  var el = document.getElementById('cmdPalette');
  el.classList.remove('hidden');
  var input = document.getElementById('cmdInput');
  input.value = '';
  _cmdActiveIdx = 0;
  renderCmdItems('');
  setTimeout(function(){ input.focus(); }, 50);
}

function closeCmdPalette() {
  document.getElementById('cmdPalette').classList.add('hidden');
}

function renderCmdItems(query) {
  var list = document.getElementById('cmdList');
  var q = query.toLowerCase().trim();
  var filtered = _cmdItems.filter(function(item) {
    if (item.type === 'divider') return !q;
    return item.label.toLowerCase().includes(q);
  });
  var actionItems = filtered.filter(function(i){ return !i.type; });
  _cmdActiveIdx = Math.min(_cmdActiveIdx, Math.max(0, actionItems.length - 1));
  var actionIdx = 0;
  list.innerHTML = filtered.map(function(item) {
    if (item.type === 'divider') return '<div class="cmd-divider">' + item.label + '</div>';
    var isActive = actionIdx === _cmdActiveIdx;
    var idx = actionIdx;
    var html = '<div class="cmd-item ' + (isActive ? 'active' : '') + '" data-idx="' + idx + '" onclick="executeCmdItem(' + idx + ')" onmouseenter="_cmdActiveIdx=' + idx + ';renderCmdItems(document.getElementById(\'cmdInput\').value)">' +
      '<span style="font-size:1.1em;">' + (item.icon || '') + '</span>' +
      '<span>' + item.label + '</span>' +
      (item.hint ? '<span class="cmd-hint">' + item.hint + '</span>' : '') +
      '</div>';
    actionIdx++;
    return html;
  }).join('');
  if (!filtered.length) list.innerHTML = '<p class="text-center text-gray-400 py-6 text-sm">No results found</p>';
}

function executeCmdItem(idx) {
  var actionItems = _cmdItems.filter(function(i){ return !i.type; });
  var item = actionItems[idx];
  if (!item) return;
  closeCmdPalette();
  if (item.section) {
    showSection(item.section, document.querySelector('[onclick*="\'' + item.section + '\'"]'));
  } else if (item.action) {
    item.action();
  }
}

function filterCmdItems(q) { _cmdActiveIdx = 0; renderCmdItems(q); }

/* ── Keyboard Shortcuts ──────────────────────────────────────────────────── */
document.addEventListener('keydown', function(e) {
  // Ctrl+K / Cmd+K → Command palette
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var pal = document.getElementById('cmdPalette');
    pal.classList.contains('hidden') ? openCmdPalette() : closeCmdPalette();
    return;
  }
  // Escape → close modals / palette
  if (e.key === 'Escape') {
    if (!document.getElementById('cmdPalette').classList.contains('hidden')) { closeCmdPalette(); return; }
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(function(m){ m.classList.add('hidden'); });
    return;
  }
  // Arrow keys and Enter in command palette input
  if (!document.getElementById('cmdPalette').classList.contains('hidden')) {
    if (document.activeElement && document.activeElement.id === 'cmdInput') {
      var cmdActionItems = _cmdItems.filter(function(i){ return !i.type; });
      var cmdQ = document.getElementById('cmdInput').value;
      var cmdFiltered = cmdActionItems.filter(function(i){ return i.label.toLowerCase().includes(cmdQ.toLowerCase().trim()); });
      if (e.key === 'ArrowDown') { e.preventDefault(); _cmdActiveIdx = Math.min(_cmdActiveIdx + 1, cmdFiltered.length - 1); renderCmdItems(cmdQ); }
      if (e.key === 'ArrowUp') { e.preventDefault(); _cmdActiveIdx = Math.max(_cmdActiveIdx - 1, 0); renderCmdItems(cmdQ); }
      if (e.key === 'Enter') { e.preventDefault(); executeCmdItem(_cmdActiveIdx); }
    }
    return;
  }
  // Don't trigger shortcuts when typing in inputs
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  // Ctrl+1-5 shortcuts
  if (e.ctrlKey || e.metaKey) {
    var sections = ['dashboard','students','teachers','sessions','fees'];
    var idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < sections.length) {
      e.preventDefault();
      showSection(sections[idx], document.querySelector('[onclick*="\'' + sections[idx] + '\'"]'));
    }
  }
});

/* ── FAB (Mobile) ──────────────────────────────────────────────────────── */
function toggleFab() {
  var btn = document.getElementById('fabBtn');
  var menu = document.getElementById('fabMenu');
  btn.classList.toggle('open');
  menu.classList.toggle('show');
}

function fabAction(section) {
  toggleFab();
  showSection(section, document.querySelector('[onclick*="\'' + section + '\'"]'));
}

document.addEventListener('click', function(e) {
  var wrap = document.getElementById('fabWrap');
  if (wrap && !wrap.contains(e.target)) {
    var fbtn = document.getElementById('fabBtn');
    var fmenu = document.getElementById('fabMenu');
    if (fbtn) fbtn.classList.remove('open');
    if (fmenu) fmenu.classList.remove('show');
  }
});

/* ── Batch Operations ────────────────────────────────────────────────────── */
function toggleSelectAll(el) {
  var checkboxes = document.querySelectorAll('.student-cb');
  _selectedStudents.clear();
  if (el.checked) {
    checkboxes.forEach(function(cb){ cb.checked = true; _selectedStudents.add(cb.value); });
  } else {
    checkboxes.forEach(function(cb){ cb.checked = false; });
  }
  updateBatchBar();
}

function toggleStudentCb(cb) {
  if (cb.checked) _selectedStudents.add(cb.value);
  else _selectedStudents.delete(cb.value);
  var all = document.getElementById('selectAllStudents');
  if (all) all.checked = _selectedStudents.size === document.querySelectorAll('.student-cb').length && _selectedStudents.size > 0;
  updateBatchBar();
}

function updateBatchBar() {
  var bar = document.getElementById('batchBar');
  if (_selectedStudents.size > 0) {
    bar.classList.remove('hidden');
    document.getElementById('batchCount').textContent = _selectedStudents.size + ' selected';
  } else {
    bar.classList.add('hidden');
  }
}

function clearBatchSelection() {
  _selectedStudents.clear();
  document.querySelectorAll('.student-cb').forEach(function(cb){ cb.checked = false; });
  var all = document.getElementById('selectAllStudents');
  if (all) all.checked = false;
  updateBatchBar();
}

async function batchLock(lock) {
  if (!_selectedStudents.size) return;
  var action = lock ? 'lock' : 'unlock';
  confirm2(
    (lock ? 'Lock' : 'Unlock') + ' ' + _selectedStudents.size + ' Students',
    'This will ' + action + ' all selected students.',
    async function() {
      var ok = 0;
      for (var id of _selectedStudents) {
        try {
          await apiFetch('/api/auth/admin/lock-student', { method: 'PATCH', body: JSON.stringify({ studentId: id, lock: lock }) });
          ok++;
        } catch(e) {}
      }
      showToast(ok + ' students ' + action + 'ed', 'success');
      clearBatchSelection();
      loadStudents(_studPage);
      if (typeof logAuditEntry === 'function') logAuditEntry('Batch ' + (lock ? 'Lock' : 'Unlock'), ok + ' students');
    },
    lock ? 'Lock All' : 'Unlock All'
  );
}

function batchExport() {
  var selected = _allStudents.filter(function(s){ return _selectedStudents.has(s._id); });
  if (!selected.length) return showToast('No students selected', 'error');
  var rows = [['Name','Email','Invite Code','Status','Joined']];
  selected.forEach(function(s){ rows.push([
    s.name, s.email || '', s.inviteCode || '',
    s.isLocked ? 'Locked' : 'Active',
    new Date(s.createdAt).toLocaleDateString()
  ]); });
  var csv = rows.map(function(r){ return r.map(function(c){ return '"' + c + '"'; }).join(','); }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'selected_students.csv';
  a.click();
  showToast('Exported ' + selected.length + ' students', 'success');
}

/* ── Student Edit Modal ──────────────────────────────────────────────────── */
function openEditStudentModal(id) {
  var s = _allStudents.find(function(x){ return x._id === id; });
  if (!s) return;
  document.getElementById('editStudentId').value = id;
  document.getElementById('editStudentName').value = s.name;
  document.getElementById('editStudentEmail').value = s.email || '';
  document.getElementById('editStudentModal').classList.remove('hidden');
}

function closeEditStudentModal() {
  document.getElementById('editStudentModal').classList.add('hidden');
}

document.getElementById('editStudentForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  var id = document.getElementById('editStudentId').value;
  try {
    await apiFetch('/api/admin/update-student/' + id, { method: 'PATCH', body: JSON.stringify({
      name: document.getElementById('editStudentName').value.trim(),
      email: document.getElementById('editStudentEmail').value.trim(),
    })});
    showToast('Student updated!', 'success');
    closeEditStudentModal();
    loadStudents(_studPage);
    if (typeof logAuditEntry === 'function') logAuditEntry('Student Updated', document.getElementById('editStudentName').value);
  } catch(e) {}
});

/* ── Skeleton Loaders ────────────────────────────────────────────────────── */
function skeletonRows(cols, count) {
  count = count || 5;
  var sizes = ['skel-xl','skel-md','skel-lg','skel-sm','skel-md','skel-sm','skel-md'];
  var html = '';
  for (var r = 0; r < count; r++) {
    html += '<tr class="skel-row">';
    for (var c = 0; c < cols; c++) {
      html += '<td><div class="skel ' + sizes[c % sizes.length] + '"></div></td>';
    }
    html += '</tr>';
  }
  return html;
}

/* ── Dashboard Extras (Pending Counts + Activity Feed) ───────────────── */
function loadDashboardExtras(statsData) {
  // Pending attention counts from stats API
  if (statsData) {
    var el1 = document.getElementById('pendingLeavesCount');
    var el2 = document.getElementById('pendingClassReqCount');
    var el3 = document.getElementById('overdueFeesDash');
    var el4 = document.getElementById('pendingDiscDash');
    if (el1) el1.textContent = statsData.pendingLeaves ?? '0';
    if (el2) el2.textContent = statsData.pendingClassRequests ?? '0';
    if (el3) el3.textContent = statsData.pendingFees ?? '0';
    if (el4) el4.textContent = statsData.pendingDiscipline ?? '0';
  }

  // Recent activity from audit log (localStorage)
  var feed = document.getElementById('dashActivityFeed');
  if (feed) {
    var log = JSON.parse(localStorage.getItem('adminAuditLog') || '[]').slice(0, 5);
    if (!log.length) {
      feed.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No recent activity yet. Actions you take will appear here.</p>';
      return;
    }
    var colors = { 'Password Reset': '#ef4444', 'Student Updated': '#f59e0b', 'Settings Updated': '#6366f1', 'Bulk Password Reset': '#ef4444', 'Batch Lock': '#ef4444', 'Batch Unlock': '#22c55e' };
    feed.innerHTML = log.map(function(entry) {
      return '<div class="act-item">' +
        '<div class="act-dot" style="background:' + (colors[entry.action] || '#f97316') + ';"></div>' +
        '<div><p class="act-text"><strong>' + entry.action + '</strong> — ' + entry.target + '</p>' +
        '<p class="act-time">' + timeAgo(new Date(entry.time)) + ' · by ' + entry.by + '</p></div></div>';
    }).join('');
  }
}

function timeAgo(date) {
  var diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

/* ── WhatsApp Messaging ── */
function sendWhatsAppMessage(mobile, studentName, type, amount = '') {
  if (!mobile) return showToast('No phone number registered for this student', 'error');
  // Format mobile to start with country code if missing. Assume 91 if length is 10
  let formatted = mobile.replace(/\D/g, '');
  if (formatted.length === 10) formatted = '91' + formatted;
  
  let msg = '';
  if (type === 'fee') {
    msg = `Hello, this is a reminder from the school. An amount of ₹${amount} is currently overdue for ${studentName}. Please arrange payment at your earliest convenience.`;
  } else if (type === 'discipline') {
    msg = `Hello, this is a notice from the school regarding ${studentName}. Please contact the administration office regarding a recent disciplinary issue.`;
  } else {
    msg = `Hello, this is a message from the school regarding ${studentName}.`;
  }
  
  window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ── Holidays Logic ─────────────────────────────────────────────── */
async function loadHolidays() {
  const tbody = document.getElementById('holidaysTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10"><span class="spin"></span></td></tr>';
  try {
    const res = await apiFetch('/api/holidays');
    const holidays = res.data || [];
    if (!holidays.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400 py-10">No holidays added yet.</td></tr>';
      return;
    }
    tbody.innerHTML = holidays.map(h => {
      const isPast = new Date(h.date) < new Date(new Date().setHours(0,0,0,0));
      return `
      <tr class="${isPast ? 'opacity-50' : ''}">
        <td class="font-medium text-gray-900">${h.name} ${isPast ? '(Past)' : ''}</td>
        <td>${new Date(h.date).toLocaleDateString()}</td>
        <td><span class="badge ${h.type === 'school' ? 'badge-present' : h.type === 'exam' ? 'badge-late' : 'badge-paid'}">${h.type}</span></td>
        <td>
          <button onclick="deleteHoliday('${h._id}')" class="btn-icon text-red-500 hover:bg-red-50" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-10">Failed to load holidays.</td></tr>';
  }
}

const hForm = document.getElementById('addHolidayForm');
if (hForm) {
  hForm.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const og = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>'; btn.disabled = true;
    try {
      await apiFetch('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('holidayName').value,
          date: document.getElementById('holidayDate').value,
          type: document.getElementById('holidayType').value,
        })
      });
      showToast('Holiday added!', 'success');
      e.target.reset();
      loadHolidays();
    } catch(err) {} finally { btn.innerHTML = og; btn.disabled = false; }
  });
}

async function deleteHoliday(id) {
  confirm2('Delete Holiday?', 'This will permanently remove the holiday.', async () => {
    try {
      await apiFetch('/api/holidays/' + id, { method: 'DELETE' });
      showToast('Holiday deleted!', 'success');
      loadHolidays();
    } catch(e) {}
  });
}

/* ── Boot ───────────────────────────────────────────────────────── */
loadDashboard();
