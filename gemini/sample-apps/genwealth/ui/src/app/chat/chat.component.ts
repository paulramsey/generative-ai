import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChatRequest, ChatResponse, GenWealthServiceClient } from '../services/genwealth-api';
import { TextToHtmlPipe } from '../common/text-to-html.pipe';

import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ChatConfigurationComponent } from './configuration/chat-configuration.component';
import { SqlStatementComponent } from '../common/sql-statement/sql-statement.component';
import { ActivatedRoute } from '@angular/router';
import { SnackBarErrorComponent } from '../common/SnackBarErrorComponent';

import { RoleService } from '../services/genwealth-api';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    FormsModule,
    MatInputModule,    
    MatSlideToggle,
    MatSidenavModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TextToHtmlPipe,
    SqlStatementComponent,
    MatIconModule,
    MatTooltipModule,
    ChatConfigurationComponent,
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit { 
  chatPlaceholder = "Ask me a question";
  loading: boolean = false;
  chatRequest: ChatRequest = new ChatRequest("");
  chatResponse?: ChatResponse = undefined;

  currentRole: string | undefined;
  currentRoleId: number | null | undefined;
  currentRoleMap: Map<string, Array<number | null>> | undefined;
  subscriptionTier: number | null | undefined;
  validRole: boolean | undefined;
  
  constructor(
    private cdRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private error: SnackBarErrorComponent,
    private genWealthClient: GenWealthServiceClient,
    private RoleService: RoleService) {}  

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const userId = params.get('userId') ?? undefined;
      this.chatRequest.userId = userId ? Number(userId) : undefined;
    });

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

      if (this.currentRole == 'Admin') {
        this.validRole = true;
      } else {
        this.validRole = false;
      }
    });
  }

  askQuestion() { 
    this.cdRef.detectChanges();
    this.loading = true;
    this.genWealthClient.chat(this.chatRequest)
      .subscribe({ 
        next: response => {
          this.chatResponse = response;
          this.loading = false;
        },
        error: err => {
          this.error.showError('Error connecting to chat server', err);
          this.loading = false;
        },
      });
  }

  getAskSuggestion() {
    this.chatRequest.prompt = "Hi Paul,\n\nI just unexpectedly inherited about $10k, and I'm not sure how I should invest it. What do you recommend? \n\nThanks,\nDonya Bartle";
  }
}
