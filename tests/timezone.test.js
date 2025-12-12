/**
 * Test Timezone Configuration
 * Chạy file này để kiểm tra cấu hình timezone
 */

const {
  getCurrentVietnamTime,
  formatVietnamDate,
  formatVietnamDateTime,
  formatVietnamTime,
  getRelativeTime,
  isToday,
  toSQLDateTime,
} = require('../utils/timezone');

console.log('='.repeat(60));
console.log('🇻🇳  VIETNAM TIMEZONE TEST');
console.log('='.repeat(60));

// Test 1: Current time
console.log('\n📅 Test 1: Current Vietnam Time');
console.log('Current Time:', getCurrentVietnamTime());
console.log('Formatted Date:', formatVietnamDate(new Date()));
console.log('Formatted DateTime:', formatVietnamDateTime(new Date()));
console.log('Formatted Time:', formatVietnamTime(new Date()));
console.log('SQL Format:', toSQLDateTime(new Date()));

// Test 2: Relative time
console.log('\n⏰ Test 2: Relative Time');
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

console.log('5 minutes ago:', getRelativeTime(fiveMinutesAgo));
console.log('2 hours ago:', getRelativeTime(twoHoursAgo));
console.log('Yesterday:', getRelativeTime(yesterday));

// Test 3: Today check
console.log('\n✅ Test 3: Date Checks');
console.log('Is today?:', isToday(new Date()));
console.log('Is yesterday today?:', isToday(yesterday));

// Test 4: Timezone info
console.log('\n🌍 Test 4: Timezone Information');
console.log('Process TZ:', process.env.TZ);
console.log(
  'Local String:',
  new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
);
console.log('ISO String:', new Date().toISOString());
console.log('UTC String:', new Date().toUTCString());

// Test 5: Database connection timezone (requires database connection)
console.log('\n💾 Test 5: Database Timezone Check');
console.log('Run: npm start and check database connection logs');

console.log('\n' + '='.repeat(60));
console.log('✅ All timezone tests completed!');
console.log('='.repeat(60) + '\n');
