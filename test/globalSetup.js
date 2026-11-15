// A fixed default time zone (one with daylight saving time) so date tests mean the same on every machine
// and in CI. `npm run test:timezones` runs the date tests again in other zones by setting TZ itself.
module.exports = () => {
  if (!process.env.TZ) process.env.TZ = 'America/Los_Angeles';
};
