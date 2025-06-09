'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'badges', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'badges');
  }
};
