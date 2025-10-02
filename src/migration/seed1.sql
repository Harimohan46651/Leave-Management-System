CREATE DATABASE IF NOT EXISTS leave_management;
USE leave_management;

-- employees table (includes password for auth)
CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  employee_code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(50),
  role ENUM('employee','reporting_manager','hr_manager','admin') DEFAULT 'employee',
  reporting_manager_id CHAR(36),
  join_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  leave_type ENUM('casual','sick','vacation','maternity') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL,
  reason TEXT,
  status ENUM('draft','pending_rm','pending_hr','approved','rejected','cancelled') DEFAULT 'draft',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  documents TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS leave_approvals (
  id CHAR(36) PRIMARY KEY,
  leave_request_id CHAR(36) NOT NULL,
  approver_id CHAR(36) NOT NULL,
  approver_type ENUM('reporting_manager','hr_manager') NOT NULL,
  action ENUM('approve','reject') NOT NULL,
  comments TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
  FOREIGN KEY (approver_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS leave_workflows (
  id CHAR(36) PRIMARY KEY,
  leave_request_id CHAR(36) NOT NULL,
  reporting_manager_approval BOOLEAN DEFAULT FALSE,
  hr_manager_approval BOOLEAN DEFAULT FALSE,
  current_stage ENUM('pending_rm','pending_hr','completed') DEFAULT 'pending_rm',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id)
);
