/**
 * Dashboard Model
 * Represents today's dashboard statistics from the API
 */

function dashBucketAmount(b) {
  if (b == null) return 0;
  if (typeof b === 'object') return parseFloat(b.total_amount ?? b.totalAmount ?? 0) || 0;
  return parseFloat(b) || 0;
}

/**
 * `by_payment_type`-style buckets: cash = hard cash; everything else (online, UPI, …) grouped as online.
 */
function normalizePaymentTypeBuckets(by) {
  if (!by || typeof by !== 'object') return null;
  let cash = dashBucketAmount(by.cash);
  let online = dashBucketAmount(by.online) + dashBucketAmount(by.non_cash);
  for (const [key, val] of Object.entries(by)) {
    const k = String(key).toLowerCase();
    if (k === 'cash' || k === 'online' || k === 'non_cash') continue;
    online += dashBucketAmount(val);
  }
  return { cash, online };
}

class Dashboard {
  constructor(data = {}) {
    // Date
    this.date = data.date || null;

    /** `closing_status` from GET /frontcash/dashboard/today: 0 = can close, 1 = already closed */
    const cs = data.closing_status;
    this.closingStatus =
      cs != null && cs !== '' && !Number.isNaN(Number(cs)) ? Number(cs) : null;

    // Frontcash statistics
    const fc = data.frontcash;
    this.frontcash = {
      totalAmount: fc?.total_amount || 0,
      count: fc?.count || 0,
    };
    const fcBt = fc?.by_type;
    this.frontcashByType =
      fcBt && typeof fcBt === 'object'
        ? {
            cash: dashBucketAmount(fcBt.cash),
            upi: dashBucketAmount(fcBt.upi),
            bank: dashBucketAmount(fcBt.bank),
            other: dashBucketAmount(fcBt.other),
          }
        : null;

    // Loans given statistics
    this.loansGiven = {
      totalAmount: data.loans_given?.total_amount || 0,
      count: data.loans_given?.count || 0,
    };
    this.loansGivenByPaymentType = normalizePaymentTypeBuckets(data.loans_given?.by_payment_type);

    // Collections statistics
    this.collections = {
      totalAmount: data.collections?.total_amount || 0,
      count: data.collections?.count || 0,
    };
    this.collectionsByPaymentType = normalizePaymentTypeBuckets(data.collections?.by_payment_type);

    // Processing fees (GET /frontcash/dashboard/today — flat or nested)
    const pfBlock = data.processing_fees ?? data.processing_fee;
    const pfFromCollections =
      data.collections?.processing_fees ??
      data.collections?.processing_fee ??
      data.collections?.total_processing_fee;
    let processingTotal = 0;
    let processingCount = 0;
    const applyPf = (raw) => {
      if (raw == null) return;
      if (typeof raw === 'object') {
        processingTotal = raw.total_amount ?? raw.totalAmount ?? processingTotal;
        processingCount = raw.count ?? processingCount;
      } else {
        processingTotal = raw;
      }
    };
    applyPf(pfBlock);
    if (!processingTotal && !processingCount) {
      applyPf(pfFromCollections);
    }
    this.processingFees = {
      totalAmount: parseFloat(processingTotal) || 0,
      count: parseInt(processingCount, 10) || 0,
    };
    this.processingFeesByPaymentType =
      pfBlock && typeof pfBlock === 'object'
        ? normalizePaymentTypeBuckets(pfBlock.by_payment_type)
        : null;

    // Expenses statistics
    this.expenses = {
      totalAmount: data.expenses?.total_amount || 0,
      count: data.expenses?.count || 0,
    };
    this.expensesByPaymentType = normalizePaymentTypeBuckets(data.expenses?.by_payment_type);

    // Tracking statistics
    this.tracking = {
      time: data.tracking?.time || 0,
      distance: data.tracking?.distance || 0,
      isTracking: data.tracking?.isTracking || false,
    };

    this.delayedCollectionCount = parseInt(data.delayed_collection_count, 10) || 0;
  }

  /**
   * **In account (online)** and **in hand (cash)** use the same rule, with amounts taken from
   * `by_type` / `by_payment_type` in GET /frontcash/dashboard/today:
   *
   * `(front cash + collection + processing fee) − (expenses + loan given)`
   *
   * — for **cash**, use each line’s **cash** bucket; for **account**, use **UPI+bank+other** on
   * front cash and **online** on collections / fees / loans. Table rows still show **totals**;
   * this method splits those totals for the footer & close payload.
   *
   * If `expenses.by_payment_type` is missing, all expenses are treated as **cash (in hand)**.
   *
   * @returns {{
   *   cash: {
   *     frontCash: number, collectionCash: number, processingCash: number,
   *     expense: number, loan: number,
   *     inflows: number, outflows: number, net: number,
   *     received: number, spent: number,
   *   },
   *   online: {
   *     frontOnline: number, collectionOnline: number, processingOnline: number,
   *     expense: number, loan: number,
   *     inflows: number, outflows: number, net: number,
   *     received: number, spent: number,
   *   },
   *   expenseAllocation: 'by_payment_type' | 'implicit_cash' | 'split_half' | 'none'
   * }}
   */
  getCloseAccountChannelBreakdown() {
    let frontCash = 0;
    let frontOnline = 0;
    if (this.frontcashByType) {
      frontCash = this.frontcashByType.cash;
      frontOnline = this.frontcashByType.upi + this.frontcashByType.bank + this.frontcashByType.other;
    }

    let collectionCash = 0;
    let collectionOnline = 0;
    if (this.collectionsByPaymentType) {
      collectionCash = this.collectionsByPaymentType.cash;
      collectionOnline = this.collectionsByPaymentType.online;
    }

    let processingCash = 0;
    let processingOnline = 0;
    if (this.processingFeesByPaymentType) {
      processingCash = this.processingFeesByPaymentType.cash;
      processingOnline = this.processingFeesByPaymentType.online;
    }

    /** Inflows for in-hand vs account (same line items as the table, split by channel). */
    const inflowsCash = frontCash + collectionCash + processingCash;
    const inflowsOnline = frontOnline + collectionOnline + processingOnline;

    let loanCash = 0;
    let loanOnline = 0;
    if (this.loansGivenByPaymentType) {
      loanCash = this.loansGivenByPaymentType.cash;
      loanOnline = this.loansGivenByPaymentType.online;
    }

    const expenseTotal = parseFloat(this.expenses?.totalAmount) || 0;
    let expenseCash = 0;
    let expenseOnline = 0;
    let expenseAllocation = 'none';

    if (
      this.expensesByPaymentType &&
      (this.expensesByPaymentType.cash > 0 || this.expensesByPaymentType.online > 0)
    ) {
      expenseCash = this.expensesByPaymentType.cash;
      expenseOnline = this.expensesByPaymentType.online;
      expenseAllocation = 'by_payment_type';
    } else if (expenseTotal > 0) {
      if (inflowsCash + inflowsOnline > 0) {
        expenseCash = expenseTotal;
        expenseAllocation = 'implicit_cash';
      } else {
        expenseCash = Math.floor(expenseTotal / 2) + (expenseTotal % 2);
        expenseOnline = expenseTotal - expenseCash;
        expenseAllocation = 'split_half';
      }
    }

    const outflowsCash = expenseCash + loanCash;
    const outflowsOnline = expenseOnline + loanOnline;

    const netCash = inflowsCash - outflowsCash;
    const netOnline = inflowsOnline - outflowsOnline;

    return {
      cash: {
        frontCash,
        collectionCash,
        processingCash,
        expense: expenseCash,
        loan: loanCash,
        inflows: inflowsCash,
        outflows: outflowsCash,
        net: netCash,
        received: inflowsCash,
        spent: outflowsCash,
      },
      online: {
        frontOnline,
        collectionOnline,
        processingOnline,
        expense: expenseOnline,
        loan: loanOnline,
        inflows: inflowsOnline,
        outflows: outflowsOnline,
        net: netOnline,
        received: inflowsOnline,
        spent: outflowsOnline,
      },
      expenseAllocation,
    };
  }

  /**
   * Hard cash vs online for **inflows** in today's dashboard: frontcash `by_type`,
   * collections `by_payment_type`, processing fees `by_payment_type`.
   * Frontcash: `cash` vs `upi` + `bank` + `other`. Other blocks: `cash` vs `online` (+ unknown keys → online).
   * Loan disbursals are not included (shown under Spent only).
   * @returns {{ cash: number, online: number }}
   */
  getCashPositionSplit() {
    let hard = 0;
    let online = 0;

    if (this.frontcashByType) {
      hard += this.frontcashByType.cash;
      online += this.frontcashByType.upi + this.frontcashByType.bank + this.frontcashByType.other;
    }

    const add = (b) => {
      if (!b) return;
      hard += b.cash;
      online += b.online;
    };

    add(this.collectionsByPaymentType);
    add(this.processingFeesByPaymentType);

    return { cash: hard, online };
  }

  /**
   * Get formatted frontcash amount
   * @returns {string}
   */
  getFormattedFrontcashAmount() {
    const amount = parseFloat(this.frontcash.totalAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted loans given amount
   * @returns {string}
   */
  getFormattedLoansGivenAmount() {
    const amount = parseFloat(this.loansGiven.totalAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted collections amount
   * @returns {string}
   */
  getFormattedCollectionsAmount() {
    const amount = parseFloat(this.collections.totalAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted processing fees amount
   * @returns {string}
   */
  getFormattedProcessingFeesAmount() {
    const amount = parseFloat(this.processingFees.totalAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted expenses amount
   * @returns {string}
   */
  getFormattedExpensesAmount() {
    const amount = parseFloat(this.expenses.totalAmount) || 0;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get formatted tracking time (in hours and minutes)
   * @returns {string}
   */
  getFormattedTrackingTime() {
    const totalSeconds = parseInt(this.tracking.time) || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get formatted tracking distance (in km)
   * @returns {string}
   */
  getFormattedTrackingDistance() {
    const distance = parseFloat(this.tracking.distance) || 0;
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)} km`;
    }
    return `${distance.toFixed(2)} m`;
  }

  /**
   * Create Dashboard instance from API response
   * @param {Object} data - Raw API response data
   * @returns {Dashboard}
   */
  static fromApiResponse(data) {
    return new Dashboard(data);
  }
}

export default Dashboard;
