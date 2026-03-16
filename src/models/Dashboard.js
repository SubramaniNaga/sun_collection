/**
 * Dashboard Model
 * Represents today's dashboard statistics from the API
 */
class Dashboard {
  constructor(data = {}) {
    // Date
    this.date = data.date || null;

    // Frontcash statistics
    this.frontcash = {
      totalAmount: data.frontcash?.total_amount || 0,
      count: data.frontcash?.count || 0,
    };

    // Loans given statistics
    this.loansGiven = {
      totalAmount: data.loans_given?.total_amount || 0,
      count: data.loans_given?.count || 0,
    };

    // Collections statistics
    this.collections = {
      totalAmount: data.collections?.total_amount || 0,
      count: data.collections?.count || 0,
    };

    // Expenses statistics
    this.expenses = {
      totalAmount: data.expenses?.total_amount || 0,
      count: data.expenses?.count || 0,
    };

    // Tracking statistics
    this.tracking = {
      time: data.tracking?.time || 0,
      distance: data.tracking?.distance || 0,
      isTracking: data.tracking?.isTracking || false,
    };
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
