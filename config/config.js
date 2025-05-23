require('dotenv').config();

module.exports = {
  development: {
    username: "postgres",
    password: "sriram",
    database: "labelarcade",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres"
  },
  test: {
    username: "postgres",
    password: "sriram",
    database: "labelarcade_test",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres"
  },
  production: {
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};
