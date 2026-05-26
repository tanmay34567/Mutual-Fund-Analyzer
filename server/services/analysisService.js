const calculateXIRR = (transactions, currentValue) => {
    // Implement XIRR calculation
    // This is a simplified version - real implementation would require date handling
    const totalInvested = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalGain = currentValue - totalInvested;
    return (totalGain / totalInvested) * 100;
  };
  
  const calculateCAGR = (beginningValue, endingValue, years) => {
    return Math.pow((endingValue / beginningValue), 1/years) - 1;
  };
  
  const calculateVolatility = (navHistory) => {
    // Calculate standard deviation of returns
    const returns = [];
    for (let i = 1; i < navHistory.length; i++) {
      returns.push((navHistory[i] - navHistory[i-1]) / navHistory[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  };
  
  module.exports = { calculateXIRR, calculateCAGR, calculateVolatility };