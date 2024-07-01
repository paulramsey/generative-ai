import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryResponse, Investment } from '../../services/genwealth-api';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';

import { TextToHtmlPipe } from '../../common/text-to-html.pipe';
import { SqlStatementComponent } from '../../common/sql-statement/sql-statement.component';

@Component({
  selector: 'app-investment-results',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule,
    MatExpansionModule,
    SqlStatementComponent,
    TextToHtmlPipe,
    MatTableModule,
  ],
  templateUrl: './investment-results.component.html',
  styleUrl: './investment-results.component.scss'
})
export class InvestmentResultsComponent {
  @Input()
  set investments(observable: Observable<QueryResponse<Investment>> | undefined) {
    if (!observable)
      return;
    
    observable.subscribe(response => {
      this.query = response.query;
      this.data = response.data;
      this.generatedQuery = response.generatedQuery;
    });
  }

  query?: string = undefined;
  data?: Investment[] = undefined;
  generatedQuery?: string = undefined;

  getColumns(obj: any) {
    return Object.keys(obj);
  }

  getRows(obj: any) {
    return Object.values(obj);
  }

}
