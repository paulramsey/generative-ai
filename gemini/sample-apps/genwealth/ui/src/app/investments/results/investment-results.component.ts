import { Component, Input, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryResponse, Investment } from '../../services/genwealth-api';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';

import { TextToHtmlPipe } from '../../common/text-to-html.pipe';
import { SqlStatementComponent } from '../../common/sql-statement/sql-statement.component';
import { UntypedFormBuilder } from '@angular/forms';
import { RoleService } from '../../services/genwealth-api';

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
    MatDividerModule
  ],
  templateUrl: './investment-results.component.html',
  styleUrl: './investment-results.component.scss'
})

export class InvestmentResultsComponent implements OnInit {
  constructor (private cdr: ChangeDetectorRef,
    private RoleService: RoleService
  ) {}

  query?: string = undefined;
  data?: Investment[] = undefined;
  generatedQuery?: string = undefined;
  errorDetail?: string = undefined;
  getSqlQuery?: string = undefined;

  currentRole: string | undefined;
  currentRoleId: number | null | undefined;
  currentRoleMap: Map<string, Array<number | null>> | undefined;
  subscriptionTier: number | null | undefined;
  enablePsv: boolean | undefined;

  ngOnInit(): void {
    console.log("Loading investment component.")
    
    this.RoleService.role$.subscribe(roleMap => {
      if (roleMap) {
        const [role] = roleMap.keys(); // Get the role name from the Map
        this.currentRole = role;
        const roleArray = roleMap.get(role);
        this.currentRoleId = roleArray? roleArray[0] : undefined;
        this.subscriptionTier = roleArray? roleArray[1] : undefined;
      } else {
        this.currentRole = undefined;
      }
    });
  }
  
  @Input()
  set investments(observable: Observable<QueryResponse<Investment>> | undefined) {
    if (!observable)
      return;
    
    observable.subscribe(response => {
      this.query = response.query;
      this.data = response.data;
      this.generatedQuery = response.generatedQuery;
      this.errorDetail = response.errorDetail;
      this.getSqlQuery = response.getSqlQuery;
      this.cdr.detectChanges();

      if (this.currentRole !== 'Admin') {
        this.enablePsv = true;
      } else {
        this.enablePsv = false;
      }
    });
  }

  getColumns(obj: any) {
    return Object.keys(obj);
  }

  getRows(obj: any) {
    return Object.values(obj);
  }
}
