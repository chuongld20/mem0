-- Create dashboard database and user (runs on first postgres init only)
CREATE USER mem0dash WITH PASSWORD 'mem0dash';
CREATE DATABASE mem0dashboard OWNER mem0dash;
GRANT ALL PRIVILEGES ON DATABASE mem0dashboard TO mem0dash;
