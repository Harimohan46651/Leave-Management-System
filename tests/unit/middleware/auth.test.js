const jwt = require('jsonwebtoken');
const { authMiddleware, permit } = require('../../../src/middleware/auth');
const { mockResponse } = require('../../helpers/testSetup');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {}, body: {}, params: {} };
    res = mockResponse();
    next = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid token', () => {
      const testUser = { id: 'user-id', email: 'test@example.com', role: 'employee' };
      const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      authMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-id');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing authorization header', () => {
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header missing' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization header format', () => {
      req.headers.authorization = 'InvalidFormat';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid Authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      req.headers.authorization = 'Bearer invalid_token';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('permit middleware', () => {
    beforeEach(() => {
      req.user = { id: 'user-id', role: 'employee' };
    });

    it('should allow access for permitted role', () => {
      const middleware = permit('employee', 'manager');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-permitted role', () => {
      const middleware = permit('admin', 'hr_manager');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user is not authenticated', () => {
      req.user = null;
      const middleware = permit('employee');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});