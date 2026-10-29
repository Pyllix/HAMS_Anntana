function startProduction(startServer = () => require('../dist/src/main')) {
  process.env.NODE_ENV = 'production';
  startServer();
}

if (require.main === module) {
  startProduction();
}

module.exports = { startProduction };
