ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

INSERT INTO users (username, password, is_admin) 
VALUES ('admin', 'justpassword', TRUE)
ON CONFLICT (username) DO UPDATE SET is_admin = TRUE, password = 'justpassword';
