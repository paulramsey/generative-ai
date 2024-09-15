import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { Highlight } from 'ngx-highlightjs';

@Component({
  selector: 'app-sql-statement',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    [Highlight]
  ],
  templateUrl: './sql-statement.component.html',
  styleUrl: './sql-statement.component.scss'
})
export class SqlStatementComponent {
  @Input()
  query?: string = undefined;
}
