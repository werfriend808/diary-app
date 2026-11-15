/*
 * Runs the date-related tests once per time zone. Node reads TZ when the process starts, so each zone
 * gets its own Jest run. Works the same on Windows, macOS and Linux.
 *   npm run test:timezones
 */
const { spawnSync } = require('node:child_process');

const ZONES = [
  'America/Los_Angeles', // UTC-8/-7, US daylight saving
  'Asia/Seoul', // UTC+9, no daylight saving
  'UTC',
  'Europe/London', // daylight saving on different dates than the US
  'Pacific/Kiritimati', // UTC+14, the first place to reach a new day
  'Pacific/Pago_Pago', // UTC-11, one of the last
];
const DATE_TESTS = ['dates', 'memories', 'letters', 'calendar', 'backup'];

let failed = [];
for (const zone of ZONES) {
  console.log(`\n=== TZ=${zone} ===`);
  const run = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--silent', ...DATE_TESTS], {
    stdio: 'inherit',
    env: { ...process.env, TZ: zone },
  });
  if (run.status !== 0) failed.push(zone);
}
if (failed.length) {
  console.error(`\nDate tests failed in: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nDate tests passed in all ${ZONES.length} time zones.`);
