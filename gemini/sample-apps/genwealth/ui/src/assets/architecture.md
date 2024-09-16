# GenWealth Demo App <img align="right" style="padding-right: 10px;" src="https://storage.googleapis.com/github-repo/generative-ai/sample-apps/genwealth/images/genwealth-logo.png" height="50px" alt="GenWealth Logo">

**Authors:** [Paul Ramsey](https://github.com/paulramsey) and [Jason De Lorme](https://github.com/jjdelorme)

 This demo showcases how you can combine the data and documents you already have and the skills you already know with the power of [AlloyDB AI](https://cloud.google.com/alloydb/ai?hl=en), [Vertex AI](https://cloud.google.com/vertex-ai?hl=en), [Cloud Run](https://cloud.google.com/run?hl=en), and [Cloud Functions](https://cloud.google.com/functions?hl=en) to build trustworthy Gen AI features into your existing applications.

## Architecture

The diagram below shows the high-level flow for the GenWealth Demo App.

<img src="assets/architecture.png" width="95%" class="center" alt="architecture diagram">

## Tech Stack

The GenWealth demo application was built using:

- [AlloyDB for PostgreSQL](https://cloud.google.com/alloydb?hl=en) 14+
- [Vertex AI](https://cloud.google.com/vertex-ai?hl=en) LLMs ([gemini-1.0-pro](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini), [textembeddings-gecko@003](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings) and [text-bison@002](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text))
- Vertex AI [Agent Builder](https://cloud.google.com/products/agent-builder?hl=en)
- [Document AI](https://cloud.google.com/document-ai?hl=en) (OCR processor)
- [Cloud Run](https://cloud.google.com/run?hl=en) (2nd generation)
- [Cloud Functions](https://cloud.google.com/functions?hl=en) (Python 3.11+)
- [Google Cloud Storage](https://cloud.google.com/storage)
- [Eventarc](https://cloud.google.com/eventarc/docs)
- [Pub/Sub](https://cloud.google.com/pubsub?hl=en)
- [LangChain](https://www.langchain.com/) 0.1.12+
- [Node](https://nodejs.org/en) 20+
- [Angular](https://angular.io/) 17+

### Database

The application database (`ragdemos`) is hosted in Google Cloud on AlloyDB, a high-performance, Enterprise-grade PostgreSQL database service.

> NOTE: For the purposes of the demo environment, the AlloyDB instance is provisioned as a Zonal instance to reduce cost. For production workloads, we strongly recommend enabling Regional availability.

#### Gen AI Integrations

AlloyDB [integrates directly](https://cloud.google.com/alloydb/docs/ai/configure-vertex-ai) with Vertex AI LLMs through the database engine to [generate embeddings](https://cloud.google.com/alloydb/docs/ai/work-with-embeddings) and perform [text completion](https://cloud.google.com/alloydb/docs/ai/invoke-predictions) functions. This empowers you to run semantic similarity search and text-completion queries on your relational database, as shown in the example queries below:

```SQL
-- Search for stocks that might perform well in a high inflation environment
-- using semantic search with Gen AI embeddings
SELECT ticker, etf, rating, analysis,
 analysis_embedding <=> google_ml.embedding('textembedding-gecko@003', 'hedge against high inflation')::vector AS distance
FROM investments
ORDER BY distance
LIMIT 5;
```

```SQL
-- Use hybrid search (semantic similarity + keywords) with Gen AI embeddings to find potential customers for a new Bitcoin ETF
SELECT first_name, last_name, email, age, risk_profile, bio,
 bio_embedding <=> google_ml.embedding('textembedding-gecko@003', 'young aggressive investor')::vector AS distance
FROM user_profiles
WHERE risk_profile = 'high'
 AND age BETWEEN 18 AND 50
ORDER BY distance
LIMIT 50;
```

```SQL
-- Give the AI a role, a mission, and output branding instructions
SELECT llm_prompt, llm_response
FROM llm(
 -- User prompt
 prompt => 'I have $25250 to invest. What do you suggest?',

 -- Prompt enrichment
 llm_role => 'You are a financial chatbot named Penny',
 mission => 'Your mission is to assist your clients by providing financial education, account details, and basic information related to budgeting, saving, and different types of investments',
 output_instructions => 'Begin your response with a professional greeting. Greet me by name if you know it. End your response with a signature that includes your name and "GenWealth" company affiliation.'
);
```

#### Schema

The GenWealth demo application leverages a simple schema, shown below.

![GenWealth Database Schema](https://storage.googleapis.com/github-repo/generative-ai/sample-apps/genwealth/images/genwealth-database-schema.png "GenWealth Database Schema")

#### Data

The `investment` and `user_profiles` tables are pre-populated with synthetic test data. The data was generated using a combination of Vertex AI LLM text completion models and simple algorithmic techniques. The `langchain_vector_store` table is used by the Document Ingestion Pipeline to store document text chunks and metadata, and the `conversation_history` table is optionally used by the [`llm()`](./database-files/llm.sql) function when the `enable_history` parameter is set to `true`.

#### AlloyDB NL2SQL

AlloyDB's natural language capabilities allow your database-driven application to more securely execute natural-language queries from your application's users, such as "Where is my package?" or "Who is the top earner in each department?" AlloyDB Omni translates the natural-language input into a SQL query specific to your database, restricting the results only to what the user of your application is allowed to view.

AlloyDB provides a get_sql() function that translates a natural language query into a SQL statement that is informed by your schema, like in the example below:

```sql
SELECT alloydb_ai_nl.get_sql(
    nl_config_id => 'ragdemos', 
    nl_question => 'What are some investments that would perform well in a high inflation environment?'
);
```

You can also add examples to help the model generate more accurate SQL using the add_example() function, as shown below:

```sql
SELECT alloydb_ai_nl.add_example(
    nl_example => 'Run a vector search on the investments table that searches the overview embedding column for the string "high inflation, hedge".',
    sql_example => 'SELECT ticker, etf, rating, analysis,
    analysis_embedding <=> google_ml.embedding(''textembedding-gecko@003'', ''high inflation, hedge'')::vector AS distance
    FROM investments
    ORDER BY distance
    LIMIT 5;',
  context_example => 'ragdemos',
    explanation_example => 'This SQL query uses the AlloyDB AI embedding function to get an embedding for the search phrase "high inflation, hedge", then it compares the generated embedding to vector embeddings stored in the analysis_embedding column. It returns the 5 most relevant results based on vector distances of the search embedding and the stored embeddings. We use the analysis_embedding field because the question is about investment performance.'
)
```

#### Parameterized Secure Views (PSV)

Natural-language queries can provide your application a powerful tool for serving your users. However, this technology also comes with clear security risks that you must consider before you allow end users to run arbitrary queries on your database tables. Even if you have configured your application to connect to your database as a limited-access, read-only database user, an application that invites natural-language queries can be vulnerable to the following:

* Malicious users can submit prompt-injection attacks, trying to manipulate the underlying model to reveal all the data the application has access to.
* The model itself might generate SQL queries broader in scope than is appropriate, revealing sensitive data in response to even well-intentioned user queries.

To help mitigate the risks described in the previous section, Google has developed parameterized secure views. Parameterized secure views let you explicitly define the tables and columns that natural-language queries can pull data from, and add additional restrictions on the range of rows available to an individual application user. These restrictions let you tightly control the data that your application's users can see through natural-language queries, no matter how your users phrase these queries.

For example, this demo app implements parameterized secure views for investments and prospects using the definitions below:

```sql
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
```

```sql
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
```

The app then uses the parameterized secure views by executing the `google_exec_param_query()` function and passing in the query along with session variables (`advisor_id` and `subscription_tier`) that are associated with the logged-in user's profile. An example of querying the database using this pattern is shown below.

> NOTE: It is a best practice to supply all session parameters that might be used by any PSVs related to your application when executing the `google_exec_param_query` function, even if the associated view does not require all of them. AlloyDB will determine which parameters (if any) are required to run the query. This allows you to simplify the query-building implementation in your application.

```sql
SELECT
  *
FROM
  alloydb_ai_nl.google_exec_param_query (
    query => 'SELECT ticker, etf, rating, analysis, subscription_tier
                FROM psv_investments
                WHERE analysis LIKE ''%high inflation%''
                        AND analysis LIKE ''%hedge%'' 
                LIMIT 5;',
    param_names => ARRAY['advisor_id', 'subscription_tier'],
    param_values => ARRAY['2', '1']
  )
```

### Document Ingestion Pipeline

In addition to the synthetic data provided for the demo, you can use the document ingestion pipeline to extract data from PDFs, like the [RYDE prospectus](https://storage.googleapis.com/github-repo/generative-ai/sample-apps/genwealth/sample-prospectus/RYDE.pdf).

Simply drop a PDF into the `$PROJECT_ID-docs` bucket to start analyzing it (we recommend using prospectuses, 10K's, or 10Q's that are named with the investment ticker like `GOOG.pdf` for this specific use case). That will kick off a pipeline of Cloud Functions that will ingest document chunks and metadata into the `langchain_vector_store` table, and it will write generated `overview` and `analysis` data and metadata to the `investments` table.

> NOTE: Pipeline processing time depends on the size of the PDF, ranging from 1 minute for small files to 10+ minutes for large files. The number of parallel documents you can ingest depends on your project quota (5 by default), and the size of documents is subject to the [quotas and limits](https://cloud.google.com/document-ai/quotas) defined by Document AI. The demo project using batch processing, and it was tested in files up to 15MB and 200 pages.

#### Pipeline Details

The pipeline is triggered when a file is uploaded to the `$PROJECT_ID-docs` GCS bucket, and it executes two parallel branches to showcase the differences between out-of-the-box Vertex AI Agent Builder capabilities versus a custom Retrieval Augmented Generation (RAG) approach.

##### RAG Pipeline Branch

The RAG pipeline branch executes the following steps:

1. The `process-pdf` Cloud Function extracts text from the pdf using Document AI (OCR), chunks the extracted text with LangChain, and writes the chunked text to the `langchain_vector_store` table in AlloyDB, leveraging [AlloyDB's LangChain vector store integration](https://python.langchain.com/docs/integrations/vectorstores/google_alloydb).
1. The `analyze-prospectus` Cloud Function retrieves the document chunks from AlloyDB and iteratively builds a company overview, analysis, and buy/sell/hold rating using Vertex AI. Results are saved to the `investments` table in AlloyDB, where AlloyDB generates embeddings of the `overview` and `analysis` columns to enable vector similary search.

##### Vertex AI Agent Builder Pipeline Branch

The Vertex AI S&C pipeline branch executes the following steps:

1. The `write-metadata` function creates a jsonl file in the `$PROJECT_ID-docs-metadata` GCS bucket to enable faceted search.
1. The `update-search-index` function kicks off re-indexing of the Vertex AI S&C data store to include the new file in its results.

### Middle Tier

The middle tier is written in TypeScript and hosted with `express`:

```javascript
import express from 'express';
...
const app: express.Application = express();
```

There are a simple set of REST apis hosted at `/api/*` that connect to AlloyDB via the `Database.ts` class.

```javascript
// Routes for the backend
app.get('/api/investments/search', async (req: express.Request, res: express.Response) => {
  ...
}
```

### Frontend

The frontend application is Angular Material using TypeScript, which is built and statically served from the root `/` by express as well:

```javascript
// Serve the frontend
app.use(express.static(staticPath));
```

### Secrets

Secrets are handled by [Secret Manager](https://cloud.google.com/security/products/secret-manager). You define the secrets for both the AlloyDB cluster and the pgAdmin interface as part of the install script. If you need to retrieve the secrets ad hoc, you can run the command below with a user that is entitled to view secrets.

```bash
gcloud secrets versions access latest --secret="my-secret"
```