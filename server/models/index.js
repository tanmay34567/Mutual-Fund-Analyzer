const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Define models
const User = require('./User')(sequelize, DataTypes);
const Portfolio = require('./Portfolio')(sequelize, DataTypes);
const MutualFund = require('./MutualFund')(sequelize, DataTypes);
const Holding = require('./Holding')(sequelize, DataTypes);

// Define relationships
User.hasMany(Portfolio, { foreignKey: 'userId', as: 'portfolios' });
Portfolio.belongsTo(User, { foreignKey: 'userId' });

Portfolio.hasMany(Holding, { foreignKey: 'portfolioId', as: 'holdings' });
Holding.belongsTo(Portfolio, { foreignKey: 'portfolioId' });

Holding.belongsTo(MutualFund, { foreignKey: 'schemeCode', targetKey: 'schemeCode' });
MutualFund.hasMany(Holding, { foreignKey: 'schemeCode', sourceKey: 'schemeCode' });

module.exports = {
  sequelize,
  User,
  Portfolio,
  MutualFund,
  Holding
};