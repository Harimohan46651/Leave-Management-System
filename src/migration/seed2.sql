USE leave_management;

-- delete if exist
DELETE FROM leave_approvals;
DELETE FROM leave_workflows;
DELETE FROM leave_requests;
DELETE FROM employees;

-- sample managers and employee (passwords are bcrypt hashes of 'password' to be created later)
INSERT INTO employees (id, employee_code, name, email, password, department, role, join_date)
VALUES
('11111111-1111-1111-1111-111111111111','EMP001','Priya Sharma','priya@company.local','$2b$10$PLACEHOLDER','Engineering','reporting_manager', '2023-01-01'),
('22222222-2222-2222-2222-222222222222','EMP002','Amit Gupta','amit@company.local','$2b$10$PLACEHOLDER','HR','hr_manager', '2022-05-01'),
('33333333-3333-3333-3333-333333333333','EMP003','Rohit Singh','rohit@company.local','$2b$10$PLACEHOLDER','Engineering','employee', '2024-01-10');

-- NOTE: update the $2b$... placeholders with real bcrypt hashes before running seed (or run register endpoint)
