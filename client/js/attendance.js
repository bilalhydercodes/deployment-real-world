// attendance.js - Attendance-related frontend utilities

/**
 * Fetch and render attendance for a given student ID
 * @param {string} studentId
 * @param {string} tbodyId - Table body element ID to render into
 */
async function fetchStudentAttendance(studentId, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    try {
        const data = await apiFetch(`/api/attendance/${studentId}`);
        if (!data.success || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-8">No records found</td></tr>';
            return null;
        }
        tbody.innerHTML = data.data.map(a => `
      <tr>
        <td>${a.subject}</td>
        <td>${new Date(a.date).toLocaleDateString()}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
      </tr>`).join('');
        return data.summary;
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-red-400 py-8">Failed to load</td></tr>';
        return null;
    }
}

/**
 * Submit an attendance record
 * @param {Object} payload - { studentId, subject, date, status }
 */
async function submitAttendance(payload) {
    return await apiFetch('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
