#!/usr/bin/env bash

# Install jq
echo "Installing jq"
sudo apt-get -y install jq

# Load env variables
source /tmp/env.sh

## Install pgadmin
echo "Installing pgadmin"
# Download certificate
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg

# Download pgAdmin4
sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list && apt update'

# Install for web mode only:
sudo apt -y install pgadmin4-web

# Configure the webserver
echo "Configuring the pgadmin webserver"
export PGADMIN_SETUP_EMAIL=$PGADMIN_USER
export PGADMIN_SETUP_PASSWORD=$PGADMIN_PASSWORD
sudo -E /usr/pgadmin4/bin/setup-web.sh --yes

# Create ragdemos Database
echo "Creating the ragdemos database"
sql=$(
  cat <<EOF
CREATE DATABASE ragdemos;
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d postgres

sleep 3

# Install AlloyDB AI extensions
echo "Installing AlloyDB AI extensions"
sql=$(
  cat <<EOF
CREATE EXTENSION IF NOT EXISTS google_ml_integration VERSION '1.3' CASCADE;
GRANT EXECUTE ON FUNCTION embedding TO postgres;
ALTER SYSTEM SET alloydb_ai_nl.enabled=on;
SELECT pg_reload_conf();
SELECT pg_sleep(1);
CREATE EXTENSION alloydb_ai_nl cascade;
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Install pgvector extension
sql=$(
  cat <<EOF
CREATE EXTENSION IF NOT EXISTS vector CASCADE;
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Register textembedding-gecko@003 embedding model
sql=$(
  cat <<EOF
CALL google_ml.create_model (
	model_id => 'textembedding-gecko@003',
	model_provider => 'google',
	model_qualified_name => 'textembedding-gecko@003',
	model_type => 'text_embedding',
	model_auth_type => 'alloydb_service_agent_iam'
);
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Register Gemini model
GEMINI_ENDPOINT="https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/gemini-1.0-pro:generateContent"
sql=$(
  cat <<EOF
CALL
google_ml.create_model (
	model_id => 'gemini',
	model_request_url => '${GEMINI_ENDPOINT}',
	model_provider => 'google',
	model_auth_type => 'alloydb_service_agent_iam'
);
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos


# Create investments table and indexes
echo "Creating tables"
sql=$(
  cat <<EOF
CREATE TABLE investments (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(255) NOT NULL UNIQUE,
  etf BOOLEAN,
  market VARCHAR(255),
  rating TEXT,
  overview TEXT,
  overview_embedding VECTOR (768),
  analysis TEXT,
  analysis_embedding VECTOR (768)
);

DROP INDEX IF EXISTS idx_hnsw_co_investments_overview_embedding;
CREATE INDEX idx_hnsw_co_investments_overview_embedding
ON investments USING hnsw (overview_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

DROP INDEX IF EXISTS idx_hnsw_co_investments_analysis_embedding;
CREATE INDEX idx_hnsw_co_investments_analysis_embedding
ON investments USING hnsw (analysis_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Create the user_profiles table
sql=$(
  cat <<EOF
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  age INT, 
  risk_profile TEXT,
  bio TEXT,
  bio_embedding VECTOR(768)
);

DROP INDEX IF EXISTS idx_user_profiles_bio_embedding;
CREATE INDEX idx_user_profiles_bio_embedding
ON user_profiles USING hnsw (bio_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Create the conversation_history table and indexes
sql=$(
  cat <<EOF
CREATE TABLE IF NOT EXISTS conversation_history (
    id SERIAL PRIMARY KEY,  
    user_id INTEGER, 
    user_prompt TEXT, 
  user_prompt_embedding VECTOR(768) GENERATED ALWAYS AS (google_ml.embedding('textembedding-gecko@003', user_prompt)::vector) STORED,
    ai_response TEXT,
  ai_response_embedding VECTOR(768) GENERATED ALWAYS AS (google_ml.embedding('textembedding-gecko@003', ai_response)::vector) STORED,
    datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);

DROP INDEX IF EXISTS idx_hnsw_co_conversation_history_user_prompt_embedding;
CREATE INDEX idx_hnsw_co_conversation_history_user_prompt_embedding
ON conversation_history USING hnsw (user_prompt_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

DROP INDEX IF EXISTS idx_hnsw_co_conversation_history_ai_response_embedding;
CREATE INDEX idx_hnsw_co_conversation_history_ai_response_embedding
ON conversation_history USING hnsw (ai_response_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Create the langchain_vector_store table and index
sql=$(
  cat <<EOF
DROP TABLE IF EXISTS public.langchain_vector_store;
CREATE TABLE IF NOT EXISTS public.langchain_vector_store
(
    langchain_id uuid NOT NULL,
    content text COLLATE pg_catalog."default" NOT NULL,
    embedding vector(768) NOT NULL,
    source character varying COLLATE pg_catalog."default",
    page integer,
    ticker character varying COLLATE pg_catalog."default",
    page_size integer,
    doc_ai_shard_count integer,
    doc_ai_shard_index integer,
    doc_ai_chunk_size integer,
    doc_ai_chunk_uri character varying COLLATE pg_catalog."default",
    page_chunk integer,
    chunk_size integer,
    langchain_metadata json,
    CONSTRAINT langchain_vector_store_pkey PRIMARY KEY (langchain_id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.langchain_vector_store
    OWNER to postgres;

DROP INDEX IF EXISTS public.idx_hnsw_co_langchain_vector_store_embedding;
CREATE INDEX IF NOT EXISTS idx_hnsw_co_langchain_vector_store_embedding
    ON public.langchain_vector_store USING hnsw
    (embedding vector_cosine_ops)
    TABLESPACE pg_default;

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Download test data
echo "Downloading data"
cd || echo "Could not cd into user profile root"
mkdir -p /tmp/demo-data
cd /tmp/demo-data || echo "Could not cd into user profile root"
gsutil -m cp \
  "gs://pr-public-demo-data/genwealth-demo/investments" \
  "gs://pr-public-demo-data/genwealth-demo/user_profiles" \
  "gs://pr-public-demo-data/genwealth-demo/llm-gemini.sql" .

# Load the investments table
echo "Loading the investments table"
sql=$(
  cat <<EOF
\copy investments FROM '/tmp/demo-data/investments' WITH (FORMAT csv, DELIMITER '|', QUOTE "'", ESCAPE "'")
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Load the user_profiles table
echo "Loading the user_profiles table"
sql=$(
  cat <<EOF
\copy user_profiles FROM '/tmp/demo-data/user_profiles' WITH (FORMAT csv, DELIMITER '|', QUOTE "'", ESCAPE "'")
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Create the llm() function
echo "Creating the llm() function"
PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos <llm-gemini.sql

# Create embeddings triggers for investments table
echo "Creating embeddings triggers"
sql=$(
  cat <<EOF
CREATE OR REPLACE FUNCTION update_overview_embedding() RETURNS trigger AS \$\$
BEGIN
  NEW.overview_embedding := google_ml.embedding('textembedding-gecko@003', NEW.overview)::vector;
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER overview_update_trigger
BEFORE INSERT OR UPDATE OF overview ON investments
FOR EACH ROW
EXECUTE PROCEDURE update_overview_embedding();

-- Analysis overview and function
CREATE OR REPLACE FUNCTION update_analysis_embedding() RETURNS trigger AS \$\$
BEGIN
  NEW.analysis_embedding := google_ml.embedding('textembedding-gecko@003', NEW.analysis)::vector;
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER analysis_update_trigger
BEFORE INSERT OR UPDATE OF analysis ON investments
FOR EACH ROW
EXECUTE PROCEDURE update_analysis_embedding();

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos


# Create and populate columns to be used in Parameterized Secure Views
echo "Creating and populating columns to be used in Parameterized Secure Views"
sql=$(
  cat <<EOF
-- Create columns
ALTER TABLE user_profiles
ADD subscriber_tier INT;

ALTER TABLE user_profiles
ADD advisor_id INT;

ALTER TABLE investments
ADD subscription_tier INT;

-- Assign even distribution of non-subscribers (0), basic subscribers (1), and premium subscribers (2)
UPDATE user_profiles
SET subscriber_tier = id % 3;

-- Assign users evenly to 10 advisors
UPDATE user_profiles
SET advisor_id = id % 10;

-- Assign subscription tiers to investments
UPDATE investments
SET subscription_tier = id % 3;

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Enable PSV extension

# Create Parameterized Secure Views
echo "Creating Parameterized Secure Views"
sql=$(
  cat <<EOF
CREATE VIEW psv_conversation_history WITH (security_barrier) AS
SELECT id, 
	user_id, 
	user_prompt, 
	user_prompt_embedding, 
	ai_response, 
	ai_response_embedding, 
	datetime
FROM conversation_history
WHERE user_id = $@user_id;

CREATE VIEW psv_investments WITH (security_barrier) AS
SELECT id, 
	ticker, 
	etf, 
	market, 
	rating, 
	overview, 
	overview_embedding, 
	analysis, 
	analysis_embedding, 
	subscription_tier
FROM investments
WHERE subscription_tier <= $@subscription_tier;

CREATE VIEW psv_user_profiles WITH (security_barrier) AS
SELECT id, 
	username, 
	email, 
	password_hash, 
	first_name, 
	last_name, 
	created_at, 
	updated_at, 
	age, 
	risk_profile, 
	bio, 
	bio_embedding, 
	subscriber_tier,
	advisor_id
FROM user_profiles
WHERE advisor_id = $@advisor_id;

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Create psv_user
echo "Creating psv_user"
sql=$(
  cat <<EOF
CREATE USER psv_user WITH PASSWORD '${ALLOYDB_PASSWORD}';

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Grant permissions to psv_user
echo "Granting permissions to psv_user"
sql=$(
  cat <<EOF
-- Grant permissions to PSVs
GRANT SELECT ON psv_conversation_history TO psv_user;
GRANT SELECT ON psv_investments TO psv_user;
GRANT SELECT ON psv_user_profiles TO psv_user;
EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos

# Add NL2SQL examples
echo "Adding NL2SQL examples"
sql=$(
  cat <<EOF
SELECT alloydb_ai_nl.g_admit_example(
	nl_example => 'Run a vector search on the investments table that searches the overview embedding column for the string "high inflation, hedge".',
	sql_example => 'SELECT ticker, etf, rating, analysis,
	analysis_embedding <=> google_ml.embedding(''textembedding-gecko@003'', ''high inflation, hedge'')::vector AS distance
	FROM investments
	ORDER BY distance
	LIMIT 5;',
	explanation_example => 'This SQL query uses the AlloyDB AI embedding function to get an embedding for the search phrase "high inflation, hedge", then it compares the generated embedding to vector embeddings stored in the analysis_embedding column. It returns the 5 most relevant results based on vector distances of the search embedding and the stored embeddings. We use the analysis_embedding field because the question is about investment performance.'
)

SELECT alloydb_ai_nl.g_admit_example(
	nl_example => 'How can I invest in sustainable energy?',
	sql_example => 'SELECT ticker, etf, rating, overview,
	overview_embedding <=> google_ml.embedding(''textembedding-gecko@003'', ''sustainable energy'')::vector AS distance
	FROM investments
	ORDER BY distance
	LIMIT 5;',
	explanation_example => 'This SQL query uses the AlloyDB AI embedding function to get an embedding for the search phrase "sustainable energy", then it compares the generated embedding to vector embeddings stored in the overview_embedding column. It returns the 5 most relevant results based on vector distances of the search embedding and the stored embeddings. We use the overview_embedding field because the question is about the company objectives.'
)

SELECT alloydb_ai_nl.g_admit_example(
	nl_example => 'Which clients might be interested in a new Bitcoin ETF?',
	sql_example => 'SELECT id, first_name, last_name, email, age, risk_profile, bio,
		bio_embedding <=> google_ml.embedding(''textembedding-gecko@003'', ''young aggressive investor'')::vector AS distance
		FROM user_profiles ORDER BY distance LIMIT 50;',
	explanation_example => 'This SQL query uses the AlloyDB AI embedding function to get an embedding for the search phrase "young aggressive investor", then it compares the generated embedding to vector embeddings stored in the bio_embedding column. It returns the 50 most relevant results based on vector distances of the search embedding and the stored embeddings. We use the user_profiles table because the question is about clients.'
)

SELECT alloydb_ai_nl.g_admit_example(
	nl_example => 'Are any of my clients managing significant debt?',
	sql_example => 'SELECT id, first_name, last_name, email, age, risk_profile, bio,
		bio_embedding <=> google_ml.embedding(''textembedding-gecko@003'', ''significant debt'')::vector AS distance
		FROM user_profiles ORDER BY distance LIMIT 50;',
	explanation_example => 'This SQL query uses the AlloyDB AI embedding function to get an embedding for the search phrase "significant debt", then it compares the generated embedding to vector embeddings stored in the bio_embedding column. It returns the 50 most relevant results based on vector distances of the search embedding and the stored embeddings. We use the user_profiles table because the question is about clients.'
)

EOF
)
echo "$sql" | PGPASSWORD=${ALLOYDB_PASSWORD} psql -h "${ALLOYDB_IP}" -U postgres -d ragdemos


echo "Access the pgadmin interface using the URL below:"
echo "http://$(curl -s ifconfig.me)/pgadmin4"
echo "Connect to AlloyDB using the following IP:"
echo "$ALLOYDB_IP"
