import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { HighlightModule } from 'ngx-highlightjs';
import { format } from 'sql-formatter';

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
        this.query = format(newQuery, { language: 'postgresql' });
      } else {
        this.query = undefined;
      }
    }
  }
}
