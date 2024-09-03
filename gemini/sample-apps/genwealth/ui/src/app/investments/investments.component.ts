import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GenWealthServiceClient, Investment, QueryResponse } from '../services/genwealth-api';
import { Observable, Subscription, catchError, finalize } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { InvestmentResultsComponent } from './results/investment-results.component';
import { SnackBarErrorComponent } from '../common/SnackBarErrorComponent';
import { ActivatedRoute } from '@angular/router';

export enum SearchType {
  KEYWORD = 'keyword',
  SEMANTIC = 'semantic',
  NATURAL = 'natural'
}

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    FormsModule,
    MatInputModule,
    MatCardModule,
    MatRadioModule,
    MatIconModule,
    MatTooltipModule,
    InvestmentResultsComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './investments.component.html',
  styleUrl: './investments.component.scss'
})
export class InvestmentsComponent implements OnInit, OnDestroy {
  constructor(
    private cdRef: ChangeDetectorRef,
    private genWealthClient: GenWealthServiceClient,
    private route: ActivatedRoute,
    private error: SnackBarErrorComponent) {}

  ngOnInit(): void {
    console.log("Loading investment component.");
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  searchTypes = SearchType;
  investmentSearch: string = '';
  searchType: string = SearchType.KEYWORD;
  loading: boolean = false;
  investments?: Observable<QueryResponse<Investment>> = undefined;
  subscription?: Subscription = undefined;

  KEYWORD_PLACEHOLDER = "Enter comma delimited key terms to search";
  SEMANTIC_PLACEHOLDER = "Describe the type of investment you are looking for";
  NATURAL_PLACEHOLDER = "Enter a natural language question describing the type of investment you are looking for";


  BUTTON_TEXT = "Find"
  LOADING_BUTTON_TEXT = "Generating SQL"

  findInvestments()  {
    this.loading = true;
    switch (this.searchType) {
      case SearchType.KEYWORD:
        this.investments =
         this.genWealthClient.searchInvestments(this.investmentSearch.split(',')).pipe(
            catchError((err: any) => {
              this.error.showError('Unable to search investments', err);
              return [];
            }),
            finalize(() => {
              this.loading = false;
            })
          );
        break;
      case SearchType.SEMANTIC:
        this.investments =
          this.genWealthClient.semanticSearchInvestments(this.investmentSearch).pipe(
            catchError((err: any) => {
              this.error.showError('Unable to search investments', err);
              return [];
            }),
            finalize(() => {
              this.loading = false;
            })
          );
        break;
      case SearchType.NATURAL:
        this.investments =
          this.genWealthClient.naturalSearchInvestments(this.investmentSearch).pipe(
            catchError((err: any) => {
              this.error.showError('SQL generation failed.', err);
              return [];
            }),
            finalize(() => {
              this.loading = false;
            })
          );
        break;
      default:
        break;
    }
  }

  getSuggestion() {
    switch (this.searchType) {
      case SearchType.KEYWORD:
        return "high inflation, hedge";
      case SearchType.SEMANTIC:
        return "hedge against high inflation";
      case SearchType.NATURAL:
        return "What are some investments that would perform well in a high inflation environment?";
      default:
        return '';
    }
  }
}
