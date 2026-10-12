-- Runs once, when the Docker volume is first created (docker-entrypoint-initdb.d).
-- yoddha_dev comes from POSTGRES_DB; this adds the database used by integration tests.
-- Integration tests wipe yoddha_test freely, so never point it at real data.
CREATE DATABASE yoddha_test;
