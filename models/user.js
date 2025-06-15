'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Submission, { foreignKey: 'userId' });
    }
  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      xp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      streakCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastSubmissionDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      badges: {
        type: DataTypes.JSON, 
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'User',
    }
  );

  return User;
};
