module.exports = (sequelize, DataTypes) => {
    const MutualFund = sequelize.define('MutualFund', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      schemeCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      latestNav: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      navDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: 'mutual_funds',
      timestamps: true
    });
  
    return MutualFund;
  };