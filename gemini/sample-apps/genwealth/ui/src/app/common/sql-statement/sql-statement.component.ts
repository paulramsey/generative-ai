import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

import { format } from 'sql-formatter';

import { HighlightModule } from 'ngx-highlightjs';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('sql', sql); 

@Component({
  selector: 'app-sql-statement',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    HighlightModule
  ],
  templateUrl: './sql-statement.component.html',
  styleUrl: './sql-statement.component.scss'
})
export class SqlStatementComponent implements OnChanges { // Implement OnChanges

  @Input() query?: string | undefined;
  formattedQuery?: string;

  ngOnChanges(changes: SimpleChanges): void {  // Use ngOnChanges
    if (changes['query']) {
      const newQuery = changes['query'].currentValue;
      if (newQuery) {
        this.query = format(newQuery, { language: 'sql' });
      } else {
        this.query = undefined;
      }
    }
  }
}
