import { Database, DatabasePsv, camelCaseRows, safeString } from './database';

export class Investments {
    constructor(private db: Database,
        private dbPsv: DatabasePsv
    ) { }

    private async executeQuery(query: string, currentRole: string, currentRoleId: number, subscriptionTier: number, searchType: string, generatedQuery: string = "", getSqlQuery: string = ""): Promise<{ data: any[], query: string, generatedQuery?: string, getSqlQuery?: string, errorDetail?: string , searchType?: string}> {
        let flattenResults = false;
        let resultRows: any[] = [];

        if (currentRole !== 'Admin' || searchType == 'FREEFORM') {
            flattenResults = true;
            let psv_query = query.replace("FROM investments", "FROM psv_investments");
            psv_query = psv_query.replace("FROM user_profiles", "FROM psv_user_profiles");
            psv_query = psv_query.replace(/'/g, "''");

            query = `SELECT * FROM
            alloydb_ai_nl.google_exec_param_query(
                query => '${psv_query}',
                param_names => ARRAY ['advisor_id', 'subscription_tier'],
                param_values => ARRAY ['${String(currentRoleId)}', '${String(subscriptionTier)}']
            )`;
        }

        try {
            let rows;
            if (currentRole === 'Admin') {
                rows = await this.db.query(query);
            } else {
                rows = await this.dbPsv.query(query); // Use dbPsv for PSV queries
            }

            if (flattenResults) {
                for (let row of rows) {
                    resultRows.push(row['json_results']);
                }
            }

            return { 
                data: camelCaseRows(flattenResults ? resultRows : rows), 
                query: query, 
                generatedQuery: generatedQuery, 
                getSqlQuery: getSqlQuery 
            };
        } catch (error) {
            const errorDetail = `Error executing query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, generatedQuery: generatedQuery, getSqlQuery: getSqlQuery, errorDetail: errorDetail }; 
        }
    }

    async search(searchTerms: string[], currentRole: string, currentRoleId: number, subscriptionTier: number) {
        let query;
        let searchType = 'KEYWORD';
        try {
            console.log('using searchTerms', searchTerms, ' with role: ', currentRole);

            query = `SELECT ticker, etf, rating, analysis, subscription_tier
                FROM investments
                WHERE analysis LIKE '%${safeString(searchTerms[0]) ?? ''}%'`;

            for (let i = 1; i < searchTerms.length; i++) {
                if (searchTerms[i].trim() !== '') {
                    query += `
                        AND analysis LIKE '%${safeString(searchTerms[i]).trim()}%'`;
                }
            }

            query += ` 
                LIMIT 5;`;

            return this.executeQuery(query, currentRole, currentRoleId, subscriptionTier, searchType);
        } catch (error) {
            const errorDetail = `search errored with query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, errorDetail: errorDetail, searchType: searchType };
        }
    }

    async semanticSearch(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number) {
        let query;
        let searchType = 'SEMANTIC';
        try {
            query = `SELECT ticker, etf, rating, analysis, subscription_tier,
            analysis_embedding <=> google_ml.embedding('textembedding-gecko@003', '${safeString(prompt)}')::vector AS distance
            FROM investments
            ORDER BY distance
            LIMIT 5;`;

        return this.executeQuery(query, currentRole, currentRoleId, subscriptionTier, searchType);
        } catch (error) {
            const errorDetail = `semanticSearch errored with query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, errorDetail: errorDetail, searchType: searchType };
        }
    }

    async naturalSearch(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number) {
        let query, generatedQuery, getSqlQuery;
        let searchType = 'NATURAL';
        try {
            const nlConfig = currentRole === 'Admin' ? 'ragdemos' : 'psv';

            getSqlQuery = `SELECT alloydb_ai_nl.get_sql(
                nl_config_id => '${nlConfig}',
                nl_question => '${safeString(prompt)}'
            )  ->> 'sql' AS generated_sql`;

            let generateSql;
            if (currentRole === 'Admin') {
                generateSql = await this.db.query(getSqlQuery);
            } else {
                generateSql = await this.dbPsv.query(getSqlQuery);
            }

            generatedQuery = generateSql[0].generated_sql;

            // Now you can use executeQuery with the generated SQL
            const result = await this.executeQuery(generatedQuery, currentRole, currentRoleId, subscriptionTier, searchType, generatedQuery, getSqlQuery);
            //result.generatedQuery = generatedQuery; // Add generatedQuery to the result
            return result; 

        } catch (error) {
            const errorDetail = `naturalSearch errored with query: ${query} and \ngeneratedQuery: ${generatedQuery}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { query: query, generatedQuery: generatedQuery, errorDetail: errorDetail, getSqlQuery: getSqlQuery, searchType: searchType };
        }
    }

    async freeformSearch(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number) {
        let query;
        let searchType = 'FREEFORM';
        try {
            query = prompt;

            return this.executeQuery(query, currentRole, currentRoleId, subscriptionTier, searchType);
        } catch (error) {
            const errorDetail = `freeformSearch errored with query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, errorDetail: errorDetail, searchType: searchType };
        }
    }
}
