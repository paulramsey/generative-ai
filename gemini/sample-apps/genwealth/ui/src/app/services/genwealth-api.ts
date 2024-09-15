import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { BASE_URL } from '../app.config';

export interface QueryResponse<T> {
    query?: string;
    data?: T[];
    generatedQuery?: string;
    errorDetail?: string;
    getSqlQuery?: string;
}

export interface Investment {
    ticker?: string;
    etf?: boolean;
    rating?: string;
    analysis?: string;
    distance?: number;
    subscriptionTier?: number;
}

export interface Prospect {
    firstName?: string;
    lastName?: string;
    email?: string;
    age?: number;
    risk_profile?: string;
    bio?: string;
    distance?: number;
    advisorId?: number;
}

export interface ChatResponse {
    llmPrompt?: string;
    llmResponse?: string;
    query?: string;
}

export class ChatRequest {
    constructor(public prompt: string) {}

    // This flag determines if the other enrichments will be used.
    advanced: boolean = false;
    
    userId?: number;
    useHistory: boolean = false;
    llmRole?: string;
    mission?: string;
    outputInstructions?: string;
    responseRestrictions: string = 'No additional restrictions';
    disclaimer?: string;
}


export interface GenWealthService {
    searchInvestments(terms: string[], currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>>;
    semanticSearchInvestments(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>>;
    naturalSearchInvestments(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>>;
    semanticSearchProspects(
        prompt: string,
        currentRole: string, 
        currentRoleId: number,
        subscriptionTier: number,
        riskProfile?: string,
        minAge?: number,
        maxAge?: number,
        advisorId?: number): Observable<QueryResponse<Prospect>>;
    chat(request: ChatRequest): Observable<ChatResponse>; 
    uploadProspectus(ticker: string, file: File): Observable<void>;
    searchProspectus(ticker: string, query: string): Observable<string>;
}

@Injectable({
    providedIn: 'root'
})
export class GenWealthServiceClient implements GenWealthService {
    constructor(private http: HttpClient, @Inject(BASE_URL) private baseUrl: string) {}
    
    searchInvestments(terms: string[], currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>> {
        if (terms.length === 1) {
            // Caveat - if only a single term is passed, the single term will be split into each char
            // prevent this by adding empty.
            terms = [terms[0], ''];
        }
        return this.http.get<QueryResponse<Investment>>(`${this.baseUrl}/investments/search`, {
            params: { terms: terms, currentRole: currentRole, currentRoleId: currentRoleId, subscriptionTier: subscriptionTier}
        });
    }

    semanticSearchInvestments(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>> {
        return this.http.get<QueryResponse<Investment>>(`${this.baseUrl}/investments/semantic-search`, {
            params: { prompt: prompt, currentRole: currentRole, currentRoleId: currentRoleId, subscriptionTier: subscriptionTier}
        });
    }

    naturalSearchInvestments(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number): Observable<QueryResponse<Investment>> {
        return this.http.get<QueryResponse<Investment>>(`${this.baseUrl}/investments/natural-search`, {
            params: { prompt: prompt, currentRole: currentRole, currentRoleId: currentRoleId, subscriptionTier: subscriptionTier }
        });
    }

    semanticSearchProspects(prompt: string, currentRole: string, currentRoleId: number, subscriptionTier: number, riskProfile?: string | undefined, minAge?: number | undefined, maxAge?: number | undefined, advisorId?: number | undefined): 
            Observable<QueryResponse<Prospect>> {
        let params: HttpParams = new HttpParams().set('prompt', prompt);

        params = params.set('currentRole', currentRole);
        params = params.set('currentRoleId', currentRoleId)
        params = params.set('subscriptionTier', subscriptionTier)
        
        if (riskProfile) {
            params = params.set('risk_profile', riskProfile);
        }
        if (minAge) {
            params = params.set('min_age', minAge);
        }
        if (maxAge) {
            params = params.set('max_age', maxAge);
        }

        return this.http.get<QueryResponse<Prospect>>(`${this.baseUrl}/prospects/search`, {params: params});
    }

    chat(request: ChatRequest): Observable<ChatResponse> {
        console.log('chat', request);
        return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, request);
    }

    uploadProspectus(ticker: string, file: File): Observable<void> {
        const formData = new FormData();
        formData.append('ticker', ticker);
        formData.append('file', file);
        return this.http.post<void>(`${this.baseUrl}/prospectus/upload`, formData);
    }

    searchProspectus(ticker: string, query: string): Observable<string> {
        return this.http.get<string>(`${this.baseUrl}/prospectus/search`, {
            params: { ticker: ticker, query: query }
        });
    }

    ragSearchProspectus(ticker: string, query: string): Observable<QueryResponse<string>> {
        return this.http.get<QueryResponse<string>>(`${this.baseUrl}/prospectus/rag-search`, {
            params: { ticker: ticker, query: query }
        }).pipe(tap(r => console.log(r)));
    }

    getTickers(): Observable<string[]> {
        return this.http.get<string[]>(`${this.baseUrl}/prospectus/tickers`);
    }    
}

@Injectable({
    providedIn: 'root'
})
export class RoleService {
  private roleChangeSource = new BehaviorSubject<Map<string, Array<number | null>> 
 | undefined>(undefined);
  role$ = this.roleChangeSource.asObservable(); 

  updateRole(newRole: Map<string, Array<number | null>> | undefined) {
    this.roleChangeSource.next(newRole);
  }

  lookupRoleDetails(role: string): Map<string, Array<number | null>> | undefined {
    // Array should be formed as follows:
    // ["Role (Name)", [role_id, subscription_id]]
    const roleMap: Map<string, Array<number | null>> = new Map([
      ["Advisor (Paul Ramsey)", [1, 2]],
      ["Advisor (Evelyn Sterling)", [2, 2]],
      ["Advisor (Arthur Kensington)", [3, 2]],
      ["Advisor (Penelope Wainwright)", [4, 2]],
      ["Advisor (Sebastian Thorne)", [5, 2]],
      ["Subscriber (Basic)", [999, 0]],
      ["Subscriber (Intermediate)", [999, 1]],
      ["Subscriber (Premium)", [999, 2]],
      ["Admin", [0, 2]]
    ]);
  
    const id = roleMap.get(role);
  
    if (id !== undefined) {
      return new Map([[role, id]]); // Create a new Map with the role and its ID
    } else {
      return undefined;
    }
  }
}