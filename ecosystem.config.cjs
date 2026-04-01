module.exports = {
  apps: [
    {
      name: "kimiko",
      script: "dist/index.js",
      cwd: "/Users/tuco/kimiko",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      max_memory_restart: "500M",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
