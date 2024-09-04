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

import { RoleService } from './services/genwealth-api';

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
  constructor(
    private breakpointObserver: BreakpointObserver, 
    private RoleService: RoleService) {}

  isSmallScreen: boolean = false;

  currentRole: string | undefined;
  currentRoleId: number | undefined;
  currentRoleMap :Map<string, number> | undefined;

  ngOnInit() { 
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe( _ => this.isSmallScreen = this.breakpointObserver.isMatched(Breakpoints.Handset) )
    
    this.RoleService.role$.subscribe(roleMap => {
      if (roleMap) {
        const [role] = roleMap.keys(); // Get the role name from the Map
        this.currentRole = role;
        this.currentRoleId = roleMap.get(role)
      } else {
        this.currentRole = undefined;
      }
    });

    this.currentRoleMap = this.RoleService.lookupRoleDetails('Admin')
    this.RoleService.updateRole(this.currentRoleMap);
  }

  

  select(pText :string)
  {
    this.currentRole = pText
    this.currentRoleMap = this.RoleService.lookupRoleDetails(this.currentRole)
    this.RoleService.updateRole(this.currentRoleMap);
  }

}
