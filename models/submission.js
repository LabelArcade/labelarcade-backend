'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Submission extends Model {
    /**
     * Associations
     */
    static associate(models) {
      // Each submission belongs to a user
      Submission.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });
    }
  }

  Submission.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE'
      },
      taskId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      answer: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      timeTakenInSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Number of seconds taken to submit the answer'
      }
    },
    {
      sequelize,
      modelName: 'Submission',
      tableName: 'Submissions',
      timestamps: true // enables createdAt & updatedAt
    }
  );

  return Submission;
};
