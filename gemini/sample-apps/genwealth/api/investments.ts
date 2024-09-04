import { Database, DatabasePsv, camelCaseRows, safeString } from './database';

export class Investments {
    constructor(private db: Database,
        private dbPsv: DatabasePsv
    ) { }

    async search(searchTerms: string[], currentRole: string, currentRoleId: number) {
        console.log('using searchTerms', searchTerms, ' with role: ', currentRole);

        // Define base query
        let query = `SELECT ticker, etf, rating, analysis
            FROM investments
            WHERE analysis LIKE '%${safeString(searchTerms[0]) ?? ''}%'`;
        
        for (let i = 1; i < searchTerms.length; i++) {
            if (searchTerms[i].trim() !== '') {
                query += `
                    AND analysis LIKE '%${safeString(searchTerms[i]).trim()}%'`;
            }
        }

        query += ` 
            LIMIT 5;`
        
        
        // Change to PSV syntax if not using Admin role
        let flattenResults: boolean = false;
        let resultRows: any[] = [];

        if (currentRole !== 'Admin') {
            flattenResults = true;
            let psv_query = query.replace("FROM investments", "FROM psv_investments").replace(/'/g,"''");

            query = `SELECT * FROM
            alloydb_ai_nl.google_exec_param_query(
                query => '${psv_query}',
                param_names => ARRAY ['subscription_tier'],
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

    async semanticSearch(prompt: string, currentRole: string, currentRoleId: number) {
        let query = `SELECT ticker, etf, rating, analysis, 
            analysis_embedding <=> google_ml.embedding('textembedding-gecko@003', '${safeString(prompt)}')::vector AS distance
            FROM investments
            ORDER BY distance
            LIMIT 5;`;

        // Change to PSV syntax if not using Admin role
        let flattenResults: boolean = false;
        let resultRows: any[] = [];

        if (currentRole !== 'Admin') {
            flattenResults = true;
            let psv_query = query.replace("FROM investments", "FROM psv_investments").replace(/'/g,"''");

            query = `SELECT * FROM
            alloydb_ai_nl.google_exec_param_query(
                query => '${psv_query}',
                param_names => ARRAY ['subscription_tier'],
                param_values => ARRAY ['${currentRoleId}']
            )`
        }

        // Execute query
        try {
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
        catch (error) {
            throw new Error(`semanticSearch errored with query: ${query}.\nError: ${(error as Error)?.message}`);
        }
        
    }

    async naturalSearch(prompt: string, currentRole: string, currentRoleId: number) {
        const query = `SELECT alloydb_ai_nl.get_sql(
            nl_query => '${safeString(prompt)}'
        )`

        try
        {
            console.log("Current role: ", currentRole)
            
            let generateSql;
            if (currentRole == 'Admin') {
                generateSql = await this.db.query(query);
            } else {
                generateSql = await this.dbPsv.query(query);
            }
            const generatedQuery = generateSql[0].get_sql;
            
            let rows;
            if (currentRole == 'Admin') {
                rows = await this.db.query(generatedQuery);
            } else {
                rows = await this.dbPsv.query(generatedQuery);
            }
            
            return { data: camelCaseRows(rows), query: query, generatedQuery: generatedQuery};
        }
        catch (error)
        {
            throw new Error(`naturalSearch errored with query: ${query}.\nError: ${(error as Error)?.message}`);
        }
    }
}
