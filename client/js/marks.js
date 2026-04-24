// marks.js - Marks-related frontend utilities

/**
 * Fetch and render marks for a given student ID
 * @param {string} studentId
 * @param {string} tbodyId - Table body element ID to render into
 */
async function fetchStudentMarks(studentId, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    try {
        const data = await apiFetch(`/api/marks/${studentId}`);
        if (!data.success || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">No records found</td></tr>';
            return null;
        }
        tbody.innerHTML = data.data.map(m => `
      <tr>
        <td>${m.subject}</td>
        <td class="capitalize">${m.examType}</td>
        <td>${m.marks}</td>
        <td>${m.totalMarks}</td>
        <td><span class="badge badge-${m.grade === 'F' ? 'absent' : m.grade === 'D' || m.grade === 'C' ? 'late' : 'present'}">${m.grade}</span></td>
      </tr>`).join('');
        return data.summary;
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-400 py-8">Failed to load</td></tr>';
        return null;
    }
}

/**
 * Submit a marks record
 * @param {Object} payload - { studentId, subject, examType, marks, totalMarks }
 */
async function submitMarks(payload) {
    return await apiFetch('/api/marks/add', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
