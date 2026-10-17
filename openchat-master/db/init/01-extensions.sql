-- Enabled automatically by the pgvector image on first DB init
-- (scripts in /docker-entrypoint-initdb.d run once when the data dir is empty).
-- Required by the memory + RAG features, which use vector(1536) columns.
CREATE EXTENSION IF NOT EXISTS vector;
