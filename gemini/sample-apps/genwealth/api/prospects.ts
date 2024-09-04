import { Database, camelCaseRows, safeString } from './database';

export class Prospects {
    constructor(private db: Database) { }

    async semanticSearch(prompt: string, currentRole: string, currentRoleId: number, riskProfile?: string, minAge?: number, maxAge?: number) {
        let query = `SELECT id, first_name, last_name, email, age, risk_profile, bio,
            bio_embedding <=> google_ml.embedding('textembedding-gecko@003', '${safeString(prompt)}')::vector AS distance
            FROM user_profiles`;

        let filters = this.getFilters(riskProfile, minAge, maxAge);
        query += filters += ` ORDER BY distance LIMIT 50;`;

        // Change to PSV syntax if not using Admin role
        let flattenResults: boolean = false;
        let resultRows: any[] = [];

        if (currentRole !== 'Admin') {
            flattenResults = true;
            let psv_query = query.replace("FROM user_profiles", "FROM psv_user_profiles").replace(/'/g,"''");

            query = `
                SELECT * FROM
                alloydb_ai_nl.google_exec_param_query(
                    query => '${psv_query}',
                    param_names => ARRAY ['advisor_id'],
                    param_values => ARRAY ['${currentRoleId}']
                )`
        }

        // Execute query
        const rows = await this.db.query(query);

        // Flatten results if response is in JSON (required for PSV)
        if (flattenResults) {
            for (let row of rows) {
                resultRows.push(row['json_results'])
            }
            return { data: camelCaseRows(resultRows), query: query };
        } else {
            // Return results without flattening if not using PSV
            return { data: camelCaseRows(rows), query: query };
        }
    }

    private getFilters(riskProfile?: string, minAge?: number, maxAge?: number) {
        let filter: string;

        if (riskProfile || minAge || maxAge) {
            filter = ` WHERE `;

            if (riskProfile) {
                filter += `risk_profile = '${riskProfile}'`;
            }

            if (minAge) {

                if (riskProfile) {
                    filter += ` AND `;
                }
                filter += ` age >= ${minAge}`;
            }

            if (maxAge) {

                if (riskProfile || minAge) {
                    filter += ` AND `;
                }
                filter += ` age <= ${maxAge}`;
            }
        }
        else {
            filter = ``;
        }

        return filter;
    }
}
