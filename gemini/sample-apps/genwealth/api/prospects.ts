import { Database, DatabasePsv, camelCaseRows, safeString } from './database';

export class Prospects {
    constructor(
        private db: Database,
        private dbPsv: DatabasePsv
    ) { }

    private async executeQuery(query: string, currentRole: string, currentRoleId: number, subscriptionTier: number): Promise<{ data: any[], query: string, errorDetail?: string }> {
        let flattenResults = false;
        let resultRows: any[] = [];

        if (currentRole !== 'Admin') {
            flattenResults = true;
            let psv_query = query.replace("FROM user_profiles", "FROM psv_user_profiles").replace(/'/g, "''");

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
                query: query
            };
        } catch (error) {
            const errorDetail = `Error executing query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, errorDetail };
        }
    }

    async semanticSearch(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number, riskProfile?: string, minAge?: number, maxAge?: number) {
        let query;
        try {
            query = `SELECT id, first_name, last_name, email, age, risk_profile, bio, advisor_id,
                bio_embedding <=> google_ml.embedding('textembedding-gecko@003', '${safeString(prompt)}')::vector AS distance
                FROM user_profiles`;

            let filters = this.getFilters(riskProfile, minAge, maxAge);
            query += filters += ` ORDER BY distance LIMIT 50;`;

            return this.executeQuery(query, currentRole, currentRoleId, subscriptionTier);

        } catch (error) {
            const errorDetail = `semanticSearch errored with query: ${query}.\nError: ${(error as Error)?.message}`;
            console.error(errorDetail);
            return { data: [], query: query, errorDetail }; 
        }
    }


    private getFilters(riskProfile?: string, minAge?: number, maxAge?: number) {
        let filter = "";

        if (riskProfile || minAge || maxAge) {
            filter = " WHERE ";
            const conditions = [];

            if (riskProfile) {
                conditions.push(`risk_profile = '${riskProfile}'`);
            }
            if (minAge) {
                conditions.push(`age >= ${minAge}`);
            }
            if (maxAge) {
                conditions.push(`age <= ${maxAge}`);
            }

            filter += conditions.join(" AND "); 
        }

        return filter;
    }
}