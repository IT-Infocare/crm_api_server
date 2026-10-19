const app = require('./src/app');

const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Infocare CRM Standalone API Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
