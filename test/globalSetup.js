// Fixed default time zone (with daylight saving time) so date tests mean the same on every machine and in CI.
// Individual tests switch process.env.TZ when they check other zones.
module.exports = () => {
  process.env.TZ = 'America/Los_Angeles';
};
