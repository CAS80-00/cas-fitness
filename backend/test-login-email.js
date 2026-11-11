const http = require('http');

// Test data for login instructions email
const testData = {
  userEmail: 'castech2222@gmail.com',
  firstName: 'Test',
  temporaryPassword: 'TempPassword123!'
};

const postData = JSON.stringify({
  email: testData.userEmail,
  firstName: testData.firstName,
  temporaryPassword: testData.temporaryPassword
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/stripe/test-login-instructions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing login instructions email...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(postData);
req.end();
