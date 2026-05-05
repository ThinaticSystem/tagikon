# storage-adapter-drizzle

Storage adapter for Tagikon using Drizzle ORM. Supports both SQLite and PostgreSQL.

## Note

Currently, the `data` field is stored as TEXT, but in the future, we are considering making the Finder the responsibility of the StorageAdapter and storing `data` in an appropriate type for each database, such as JSONB for PostgreSQL.
