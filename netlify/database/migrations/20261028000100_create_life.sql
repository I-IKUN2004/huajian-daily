CREATE TABLE life_documents (
 namespace TEXT NOT NULL,
 bucket TEXT NOT NULL,
 key TEXT NOT NULL,
 value JSONB NOT NULL,
 version BIGINT NOT NULL DEFAULT 1,
 PRIMARY KEY(namespace,bucket,key)
);
CREATE INDEX life_documents_bucket ON life_documents(namespace,bucket);

