/**
 * Collection Model
 * Represents a collection record from the API
 */
class Collection {
  constructor(data = {}) {
    // Core collection fields
    this.id = data.id || null;
    this.loanId = data.loan_id || null;
    this.customerId = data.customer_id || null;
    this.employeeId = data.employee_id || null;
    this.collectionDate = data.collection_date || null;
    this.amountPaid = data.amount_paid || '0';
    this.balanceAmount = data.balance_amount || '0';
    this.collectionWeek = data.collection_week || null;
    this.notes = data.notes || null;
    this.createdAt = data.created_at || null;
    this.updatedAt = data.updated_at || null;

    // Customer fields
    this.customerName = data.customer_name || null;
    this.customerPhone = data.customer_phone || null;
    this.customerNo = data.customer_no || null;
    this.customerAddress = data.customer_address || null;
    this.customerPhoto = data.customer_photo || null;

    // Loan fields
    this.loanAmount = data.loan_amount || '0';
    this.approvedAmount = data.approved_amount || '0';
    this.loanPeriod = data.loan_period || null;
    this.approvalStatus = data.approval_status || null;

    // Branch and Line fields
    this.branchName = data.branch_name || null;
    this.branchId = data.branch_id || null;
    this.lineName = data.line_name || null;
    this.employeeName = data.employeename || null;
    this.lineId = data.line_id || null;
    this.locality = data.locality || null;
  }

  /**
   * Check if collection is paid
   * @returns {boolean}
   */
  isPaid() {
    const paid = parseFloat(this.amountPaid) || 0;
    return paid > 0;
  }

  /**
   * Get formatted amount paid
   * @returns {string}
   */
  getFormattedAmountPaid() {
    const amount = parseFloat(this.amountPaid) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted balance amount
   * @returns {string}
   */
  getFormattedBalanceAmount() {
    const amount = parseFloat(this.balanceAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted collection date
   * @returns {string}
   */
  getFormattedCollectionDate() {
    if (!this.collectionDate) return '—';
    try {
      return new Date(this.collectionDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return this.collectionDate;
    }
  }

  /**
   * Get status badge color
   * @returns {string}
   */
  getStatusColor() {
    return this.isPaid() ? '#4CAF50' : '#FF9800';
  }

  /**
   * Get status text
   * @returns {string}
   */
  getStatusText() {
    return this.isPaid() ? 'Paid' : 'Pending';
  }

  /**
   * Create Collection instance from API response
   * @param {Object} data - Raw API response data
   * @returns {Collection}
   */
  static fromApiResponse(data) {
    return new Collection(data);
  }

  /**
   * Create array of Collection instances from API response
   * @param {Array} dataArray - Array of raw API response data
   * @returns {Array<Collection>}
   */
  static fromApiResponseArray(dataArray) {
    if (!Array.isArray(dataArray)) {
      return [];
    }
    return dataArray.map((item) => Collection.fromApiResponse(item));
  }
}

export default Collection;
