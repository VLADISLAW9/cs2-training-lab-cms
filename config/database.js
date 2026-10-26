module.exports = ({ env }) => ({
  connection: {
    client: "postgres",
    connection: {
      connectionString: env("DATABASE_URL"),
      ssl: env.bool("DATABASE_SSL", false)
        ? { rejectUnauthorized: true }
        : false,
    },
    pool: { min: 2, max: 10 },
  },
});
