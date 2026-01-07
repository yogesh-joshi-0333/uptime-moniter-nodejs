// test/run_all.js
// End‑to‑end demo script: seed dummy data, then start scheduler, worker, and API server.

const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args, name) {
  const proc = spawn(command, args, { stdio: 'inherit', env: process.env, shell: true });
  proc.on('close', code => {
    console.log(`${name} exited with code ${code}`);
    if (code !== 0) {
      console.error(`${name} failed – terminating demo.`);
      process.exit(code);
    }
  });
  return proc;
}

async function main() {
  console.log('🔹 Starting dummy data seed...');
  await new Promise((resolve, reject) => {
    const seed = spawn('node', [path.join(__dirname, 'seed.js')], { stdio: 'inherit', env: process.env, shell: true });
    seed.on('close', code => (code === 0 ? resolve() : reject(new Error(`seed script exited with code ${code}`))));
  });

  console.log('✅ Seed completed. Starting services...');

  // Use absolute paths based on __dirname
  const schedulerPath = path.join(__dirname, '..', 'scheduler', 'index.js');
  const workerPath = path.join(__dirname, '..', 'worker', 'index.js');
  const apiPath = path.join(__dirname, '..', 'api', 'server.js');

  const scheduler = runCommand('node', [schedulerPath], 'Scheduler');
  const worker = runCommand('node', [workerPath], 'Worker');
  const api = runCommand('node', [apiPath], 'API Server');

  const shutdown = () => {
    console.log('\n🔻 Shutting down demo...');
    scheduler.kill('SIGTERM');
    worker.kill('SIGTERM');
    api.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});
