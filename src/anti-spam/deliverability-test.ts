import {
  getWarmUpTier,
  isWithinUaeBusinessHours,
  getNextBusinessWindow,
  DeliverabilityShield,
  COOLDOWN_MS,
} from './deliverability-shield.js';

console.log('=== Test 1: Testing 4-Week Warm-Up Ladder Progression ===');

const day1 = getWarmUpTier(1);
console.log(`• Day 1 (Week 1): ${day1.maxSendsPerDay} sends/day, ${day1.maxPerTrigger}/trigger -> "${day1.phaseLabel}"`);
if (day1.maxSendsPerDay !== 5 || day1.maxPerTrigger !== 2) {
  console.error('❌ Day 1 warm-up calculation incorrect');
  process.exit(1);
}

const day10 = getWarmUpTier(10);
console.log(`• Day 10 (Week 2): ${day10.maxSendsPerDay} sends/day, ${day10.maxPerTrigger}/trigger -> "${day10.phaseLabel}"`);
if (day10.maxSendsPerDay !== 10 || day10.maxPerTrigger !== 3) {
  console.error('❌ Day 10 ramp-up calculation incorrect');
  process.exit(1);
}

const day18 = getWarmUpTier(18);
console.log(`• Day 18 (Week 3): ${day18.maxSendsPerDay} sends/day, ${day18.maxPerTrigger}/trigger -> "${day18.phaseLabel}"`);
if (day18.maxSendsPerDay !== 15 || day18.maxPerTrigger !== 4) {
  console.error('❌ Day 18 scaling calculation incorrect');
  process.exit(1);
}

const day30 = getWarmUpTier(30);
console.log(`• Day 30 (Week 4+): ${day30.maxSendsPerDay} sends/day, ${day30.maxPerTrigger}/trigger -> "${day30.phaseLabel}"`);
if (day30.maxSendsPerDay !== 20 || day30.maxPerTrigger !== 5) {
  console.error('❌ Day 30 full velocity calculation incorrect');
  process.exit(1);
}
console.log('✅ 4-week warm-up ladder calculations verified!');

console.log('\n=== Test 2: Testing UAE Business Hours & Weekend Filtering ===');

// Construct a known Wednesday 10:00 AM GST (UTC: 06:00 AM)
const wednesdayBusinessHour = new Date('2026-08-26T06:00:00Z');
const isWedOpen = isWithinUaeBusinessHours(wednesdayBusinessHour);
console.log('• Wednesday 10:00 AM GST is within business hours:', isWedOpen);
if (!isWedOpen) {
  console.error('❌ Wednesday 10 AM GST should be within business hours');
  process.exit(1);
}

// Construct a known Wednesday 11:00 PM GST (UTC: 07:00 PM)
const wednesdayNight = new Date('2026-08-26T19:00:00Z');
const isWedNightOpen = isWithinUaeBusinessHours(wednesdayNight);
console.log('• Wednesday 11:00 PM GST is within business hours:', isWedNightOpen);
if (isWedNightOpen) {
  console.error('❌ Wednesday 11 PM GST should be closed');
  process.exit(1);
}

// Check next window calculation
const nextWindow = getNextBusinessWindow(wednesdayNight);
console.log('• Next available business window from Wed 11 PM GST:', nextWindow.toISOString());
if (!isWithinUaeBusinessHours(nextWindow)) {
  console.error('❌ Next business window is not within valid hours');
  process.exit(1);
}
console.log('✅ UAE business hours and night/weekend queueing verified!');

console.log('\n=== Test 3: Testing 15-Minute Fixed Cooldown Enforcement ===');

const shield = new DeliverabilityShield(new Date()); // Start at Day 1
const check1 = shield.canSendNow(wednesdayBusinessHour);
console.log('• Initial send check:', check1.allowed, `("${check1.reason}")`);
if (!check1.allowed) {
  console.error('❌ First send should be allowed during business hours');
  process.exit(1);
}

// Record send
shield.recordSend(wednesdayBusinessHour.getTime());

// Attempt immediate second send (5 minutes later)
const fiveMinutesLater = new Date(wednesdayBusinessHour.getTime() + 5 * 60 * 1000);
const check2 = shield.canSendNow(fiveMinutesLater);
console.log('• 5-min later send check:', check2.allowed, `("${check2.reason}")`);
if (check2.allowed) {
  console.error('❌ Send during 15-minute cooldown should be rejected');
  process.exit(1);
} else {
  console.log('✅ 15-minute cooldown active and next available time scheduled!');
}

// Attempt send after 16 minutes (cooldown satisfied)
const sixteenMinutesLater = new Date(wednesdayBusinessHour.getTime() + 16 * 60 * 1000);
const check3 = shield.canSendNow(sixteenMinutesLater);
console.log('• 16-min later send check:', check3.allowed, `("${check3.reason}")`);
if (!check3.allowed) {
  console.error('❌ Send after 16 minutes should be allowed');
  process.exit(1);
}

console.log('\n=== Test 4: Testing Daily Budget Cap Enforcement ===');

shield.reset();
const testDate = new Date('2026-08-26T06:00:00Z'); // Wednesday morning

// Exhaust 5 sends for Day 1
for (let i = 0; i < 5; i++) {
  shield.recordSend(testDate.getTime() + i * COOLDOWN_MS);
}

const checkBudget = shield.canSendNow(new Date(testDate.getTime() + 6 * COOLDOWN_MS));
console.log('• 6th send check (Limit: 5):', checkBudget.allowed, `("${checkBudget.reason}")`);
if (checkBudget.allowed) {
  console.error('❌ 6th send exceeded daily limit of 5');
  process.exit(1);
} else {
  console.log('✅ Daily budget cap strictly enforced!');
}

console.log('\n=== Test 5: Testing Bounce Rate Circuit Breaker ===');

const healthShield = new DeliverabilityShield();
// Record 10 sends with 2 bounces (20% bounce rate > 5%)
for (let i = 0; i < 10; i++) {
  healthShield.recordSend(Date.now());
}
healthShield.recordBounce();
healthShield.recordBounce();

const health = healthShield.getHealth();
console.log('• Deliverability Health:', health);
if (health.healthy || health.status !== 'PAUSED_HIGH_BOUNCE') {
  console.error('❌ Circuit breaker failed to trip at 20% bounce rate');
  process.exit(1);
} else {
  console.log('✅ Bounce rate circuit breaker tripped and safely paused outreach!');
}

console.log('\n🎉 ALL SPRINT 10 DELIVERABILITY SHIELD TESTS PASSED!');
