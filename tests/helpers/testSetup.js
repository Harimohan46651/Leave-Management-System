const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Mock database pool
const mockPool = {
  query: jest.fn(),
  end: jest.fn()
};

// Mock database connection
const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

// Test user data
const testUsers = {
  employee: {
    id: uuidv4(),
    name: 'Test Employee',
    email: 'employee@test.com',
    role: 'employee',
    reporting_manager_id: uuidv4()
  },
  manager: {
    id: uuidv4(),
    name: 'Test Manager',
    email: 'manager@test.com',
    role: 'reporting_manager'
  },
  hr: {
    id: uuidv4(),
    name: 'Test HR',
    email: 'hr@test.com',
    role: 'hr_manager'
  },
  admin: {
    id: uuidv4(),
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'admin'
  }
};

// Generate test tokens
const generateToken = (user) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// Mock request/response objects
const mockRequest = (user = null, body = {}, params = {}) => ({
  user,
  body,
  params,
  headers: user ? { authorization: `Bearer ${generateToken(user)}` } : {}
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Test leave data
const testLeave = {
  id: uuidv4(),
  employee_id: testUsers.employee.id,
  leave_type: 'casual',
  start_date: '2024-02-01',
  end_date: '2024-02-03',
  total_days: 3,
  reason: 'Personal work',
  status: 'pending_rm',
  applied_at: new Date()
};

module.exports = {
  mockPool,
  mockConnectDB,
  testUsers,
  generateToken,
  mockRequest,
  mockResponse,
  testLeave,
  JWT_SECRET
};