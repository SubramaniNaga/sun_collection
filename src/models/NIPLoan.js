import { formatCurrency } from '../utils/amountFormatters';
import { formatDisplayDate } from '../utils/dateFormatter';

/**
 * NIP Loan Model
 * Represents a NIP (Network Integration Point) loan record from the API
 */
class NIPLoan {
  constructor(data = {}) {
    // Core loan fields
    this.id = data.id || null;
    this.loanId = data.loan_id || null;
    this.customerId = data.customer_id || null;
    this.branchId = data.branch_id || null;
    this.lineId = data.line_id || null;
    this.loanAmount = data.loan_amount || '0';
    this.approvedAmount = data.approved_amount || null;
    this.balanceAmount = data.balance_amount || null;
    this.nipPaidTotal = data.nip_paid_total ?? null;
    this.intrestAmount = data.intrest_amount || null;
    this.processingFees = data.processing_fees || null;
    this.paymentType = data.payment_type || null;
    this.loantypeId = data.loantype_id || null;
    this.loanTypeName = data.loan_type_name || null;
    this.loanPeriod = data.loan_period || null;
    this.approvalStatus = data.approval_status || null;
    this.loanStatusName = data.loan_status_name || null;
    this.loanStatus = data.loan_status || null;
    this.requestedDate = data.requested_date || null;
    this.approvedDate = data.approved_date || null;
    this.loanClosedOn = data.loan_closed_on || null;
    this.rejectReason = data.reject_reason || null;
    this.rejectedDate = data.rejected_date || null;
    this.createdAt = data.created_at || null;
    this.updatedAt = data.updated_at || null;

    // Customer fields
    this.customerName = data.customer_name || null;
    this.customerPhone = data.customer_phone || null;
    this.customerNo = data.customer_no || null;
    this.customerAddress = data.customer_address || null;
    this.customerPhoto = data.customer_photo || null;
    this.addressProof = data.address_proof || null;
    this.addressLatitude = data.address_latitude || null;
    this.addressLongitude = data.address_longitude || null;

    // Branch and Line fields
    this.branchName = data.branch_name || data.branch || null;
    this.lineName = data.line_name || null;
    this.locality = data.locality || null;

    // Collection count fields
    this.completedCount = data.completed_collection_count ?? null;
    this.pendingCount = data.pending_collection_count ?? null;
    this.totalCount = data.current_collection_due_count ?? null;

    // Loan given fields
    this.loangivenPhoto = data.loangiven_photo || null;
    this.loangivenLatitude = data.loangiven_latitude || null;
    this.loangivenLongitude = data.loangiven_longitude || null;
  }

  /**
   * Get formatted loan amount
   * @returns {string}
   */
  getFormattedLoanAmount() {
    if (!this.loanAmount) return '—';
    return formatCurrency(this.loanAmount);
  }

  /**
   * Get formatted approved amount
   * @returns {string}
   */
  getFormattedApprovedAmount() {
    if (!this.approvedAmount) return '—';
    return formatCurrency(this.approvedAmount);
  }

  /**
   * Get formatted balance amount
   * @returns {string}
   */
  getFormattedBalanceAmount() {
    if (!this.balanceAmount) return '—';
    return formatCurrency(this.balanceAmount);
  }

  /**
   * Get formatted requested date
   * @returns {string}
   */
  getFormattedRequestedDate() {
    return formatDisplayDate(this.requestedDate);
  }

  /**
   * Get status label
   * @returns {string}
   */
  getStatusLabel() {
    if (this.approvalStatus === '2') return 'Rejected';
    if (this.loanStatus === '4') return 'Closed';
    if (this.approvalStatus === '0') return 'Pending';
    if (this.loanStatus === '3') return 'Active';
    if (this.loanStatus === '2' || this.approvalStatus === '1') return 'Approved';
    return 'Pending';
  }

  /**
   * Get status color
   * @returns {string}
   */
  getStatusColor() {
    const label = this.getStatusLabel();
    if (label === 'Active') return '#28a745';
    if (label === 'Rejected') return '#dc3545';
    if (label === 'Closed') return '#6c757d';
    if (label === 'Approved') return '#0536a3';
    return '#ffc107';
  }

  /**
   * Create NIPLoan instance from API response
   * @param {Object} data - Raw data from API
   * @returns {NIPLoan}
   */
  static fromApiResponse(data) {
    return new NIPLoan(data);
  }

  /**
   * Create array of NIPLoan instances from API response array
   * @param {Array} dataArray - Array of raw data from API
   * @returns {Array<NIPLoan>}
   */
  static fromApiResponseArray(dataArray) {
    if (!Array.isArray(dataArray)) return [];
    return dataArray.map(item => NIPLoan.fromApiResponse(item));
  }
}

export default NIPLoan;
