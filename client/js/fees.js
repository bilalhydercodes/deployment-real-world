// fees.js - Fees-related frontend utilities

/**
 * Fetch and render fees for a given student ID
 * @param {string} studentId
 * @param {string} tbodyId - Table body element ID to render into
 */
async function fetchStudentFees(studentId, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    try {
        const data = await apiFetch(`/api/fees/${studentId}`);
        if (!data.success || !data.data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">No fee records found</td></tr>';
            return null;
        }
        tbody.innerHTML = data.data.map(f => `
      <tr>
        <td class="capitalize">${f.feeType}</td>
        <td>₹${f.amount.toLocaleString()}</td>
        <td><span class="badge badge-${f.status}">${f.status}</span></td>
        <td>${new Date(f.dueDate).toLocaleDateString()}</td>
        <td>${f.paymentDate ? new Date(f.paymentDate).toLocaleDateString() : '—'}</td>
      </tr>`).join('');
        return data.summary;
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-400 py-8">Failed to load</td></tr>';
        return null;
    }
}

/**
 * Add a fee record (Admin)
 * @param {Object} payload - { studentId, feeType, amount, dueDate, description }
 */
async function addFeeRecord(payload) {
    return await apiFetch('/api/fees/add', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/**
 * Mark a fee as paid (Admin)
 * @param {string} feeId
 */
async function markFeeAsPaid(feeId) {
    return await apiFetch('/api/fees/pay', {
        method: 'POST',
        body: JSON.stringify({ feeId }),
    });
}
