import { formatDisplayDate } from '../utils/dateFormatter';

/**
 * Collection History Model
 * Represents a collection history record from the API
 */
class CollectionHistory {
  constructor(data = {}) {
    // Core collection fields
    this.id = data.id || null;
    this.loanId = data.loan_id || null;
    this.customerId = data.customer_id || null;
    this.employeeId = data.employee_id || null;
    this.branchId = data.branch_id || null;
    this.lineId = data.line_id || null;
    this.collectionDate = data.collection_date || null;
    this.paymentDate = data.payment_date || null;
    this.amountPaid = data.amount_paid || '0';
    this.balanceAmount = data.balance_amount || '0';
    this.collectionWeek = data.collection_week || null;
    this.notes = data.notes || null;
    this.latitude = data.latitude || null;
    this.longitude = data.longitude || null;
    this.paymentType = data.payment_type || null;
    this.paymentTime = data.payment_time || null;
    this.userCreatedBy = data.user_created_by || null;
    this.userUpdatedBy = data.user_updated_by || null;
    this.createdAt = data.created_at || null;
    this.updatedAt = data.updated_at || null;

    // Customer fields
    this.customerName = data.customer_name || null;
    this.customerPhone = data.customer_phone || null;
    this.customerNo = data.customer_no || null;
    this.customerAddress = data.customer_address || null;

    // Loan fields
    this.loanAmount = data.loan_amount || '0';
    this.approvedAmount = data.approved_amount || '0';
    this.loanPeriod = data.loan_period || null;
    this.approvalStatus = data.approval_status || null;
    this.loanStatus = data.loan_status || null;

    // Branch and Line fields
    this.branchName = data.branch_name || null;
    this.lineName = data.line_name || null;
    this.employeeName = data.employeename || null;
    this.locality = data.locality || null;
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
   * Get formatted payment date
   * @returns {string}
   */
  getFormattedPaymentDate() {
    return formatDisplayDate(this.paymentDate);
  }

  /**
   * Get formatted collection date
   * @returns {string}
   */
  getFormattedCollectionDate() {
    return formatDisplayDate(this.collectionDate);
  }

  /**
   * Get payment type label
   * @returns {string}
   */
  getPaymentTypeLabel() {
    if (!this.paymentType) return '—';
    return this.paymentType.charAt(0).toUpperCase() + this.paymentType.slice(1);
  }

  /**
   * Get receipt number (can be formatted as needed)
   * @returns {string}
   */
  getReceiptNumber() {
    return `R${String(this.id).padStart(6, '0')}`;
  }

  /**
   * Create CollectionHistory instance from API response
   * @param {Object} data - Raw data from API
   * @returns {CollectionHistory}
   */
  static fromApiResponse(data) {
    return new CollectionHistory(data);
  }

  /**
   * Create array of CollectionHistory instances from API response array
   * @param {Array} dataArray - Array of raw data from API
   * @returns {Array<CollectionHistory>}
   */
  static fromApiResponseArray(dataArray) {
    if (!Array.isArray(dataArray)) return [];
    return dataArray.map(item => CollectionHistory.fromApiResponse(item));
  }
}

export default CollectionHistory;
