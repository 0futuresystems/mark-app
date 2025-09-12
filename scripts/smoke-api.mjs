#!/usr/bin/env node

/**
 * Minimal API smoke tests for security hardening
 * Tests unauthorized access to protected endpoints
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testEndpoint(method, path, body = null, expectedStatus = 401) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-site.com', // Test origin validation
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const status = response.status;
    const isExpected = status === expectedStatus || status === 403; // Allow 403 for origin check

    console.log(`${method} ${path}: ${status} ${isExpected ? '✅' : '❌'}`);
    
    if (!isExpected) {
      const text = await response.text();
      console.log(`  Unexpected response: ${text.substring(0, 100)}`);
    }

    return isExpected;
  } catch (error) {
    console.log(`${method} ${path}: ERROR ${error.message} ❌`);
    return false;
  }
}

async function runSmokeTests() {
  console.log('🧪 Running API smoke tests...\n');

  const tests = [
    // Test unauthorized access to protected endpoints
    ['POST', '/api/sign-put', { auctionId: 'test', contentType: 'image/jpeg' }],
    ['POST', '/api/sign-get', { objectKey: 'test', auctionId: 'test' }],
    ['POST', '/api/export/csv', { data: { lots: [], media: [] } }],
    ['POST', '/api/email', { subject: 'test' }],
    
    // Test debug endpoints (should be 404 in prod or 401/403 in dev)
    ['GET', '/api/_email-health'],
    ['GET', '/api/_r2-health'],
  ];

  let passed = 0;
  let total = tests.length;

  for (const [method, path, body] of tests) {
    const success = await testEndpoint(method, path, body);
    if (success) passed++;
  }

  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All smoke tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the output above.');
    process.exit(1);
  }
}

// Run tests
runSmokeTests().catch(error => {
  console.error('💥 Smoke test runner failed:', error);
  process.exit(1);
});
