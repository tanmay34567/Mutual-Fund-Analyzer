module.exports = (sequelize, DataTypes) => {
    const Holding = sequelize.define('Holding', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      portfolioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'portfolios',
          key: 'id'
        }
      },
      schemeCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        references: {
          model: 'mutual_funds',
          key: 'schemeCode'
        }
      },
      units: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      buyPrice: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      buyDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
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
      tableName: 'holdings',
      timestamps: true
    });
  
    return Holding;
  };