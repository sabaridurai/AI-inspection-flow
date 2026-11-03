import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideLucideIcons, LucideActivity, LucideArrowDownRight, LucideArrowLeft, LucideArrowRight, LucideArrowUpRight, LucideBell, LucideCalendarDays, LucideCamera, LucideChartNoAxesCombined, LucideCheck, LucideChevronDown, LucideCircleAlert, LucideCircleHelp, LucideClipboardCheck, LucideClipboardList, LucideDownload, LucideFileCheck2, LucidePlus, LucideSearch, LucideSettings, LucideShieldCheck, LucideSlidersHorizontal, LucideSparkles, LucideX } from '@lucide/angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideLucideIcons(LucideActivity, LucideArrowDownRight, LucideArrowLeft, LucideArrowRight, LucideArrowUpRight, LucideBell, LucideCalendarDays, LucideCamera, LucideChartNoAxesCombined, LucideCheck, LucideChevronDown, LucideCircleAlert, LucideCircleHelp, LucideClipboardCheck, LucideClipboardList, LucideDownload, LucideFileCheck2, LucidePlus, LucideSearch, LucideSettings, LucideShieldCheck, LucideSlidersHorizontal, LucideSparkles, LucideX),
  ]
};
