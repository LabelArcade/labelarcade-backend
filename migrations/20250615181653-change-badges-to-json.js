'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'badges', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: []
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'badges', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: []
    });
  }
};
