import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints} from '@angular/cdk/layout';

import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

import { InvestmentsComponent } from './investments/investments.component';
import { ProspectsComponent } from './prospects/prospects.component';
import { ChatComponent } from './chat/chat.component';
import { SnackBarErrorComponent } from './common/SnackBarErrorComponent';

import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDividerModule} from '@angular/material/divider';

import {MatMenuModule} from '@angular/material/menu';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    InvestmentsComponent,
    ProspectsComponent,
    ChatComponent,
    MatButtonToggleModule, 
    MatCheckboxModule,
    MatDividerModule,
    MatMenuModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [SnackBarErrorComponent]
})
export class AppComponent implements OnInit {
  constructor(private breakpointObserver: BreakpointObserver) {}

  isSmallScreen: boolean = false;

  ngOnInit() { 
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe( _ => this.isSmallScreen = this.breakpointObserver.isMatched(Breakpoints.Handset) )
    this.selected = 'Admin';
  }

  selected :string | undefined;

  select(pText :string)
  {
    this.selected = pText
  }

  lookupIdByRole(role: string): number | undefined {
    const roleMap: Map<string, number> = new Map([
      ["Advisor (Paul Ramsey)", 1],
      ["Advisor (Evelyn Sterling)", 2],
      ["Advisor (Arthur Kensington)", 3],
      ["Advisor (Penelope Wainwright)", 4],
      ["Advisor (Sebastian Thorne)", 5],
      ["Subscriber (Basic)", 0],
      ["Subscriber (Intermediate)", 1],
      ["Subscriber (Premium)", 2],
    ]);
  
    return roleMap.get(role); 
  }

}
