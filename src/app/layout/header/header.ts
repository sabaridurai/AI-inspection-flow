import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-header',
  imports: [LucideDynamicIcon, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly auth = inject(Auth);
  readonly open = input(false);
  readonly menuToggle = output<void>();
  readonly displayName = this.auth.displayName;
  readonly initials = this.auth.initials;
}
