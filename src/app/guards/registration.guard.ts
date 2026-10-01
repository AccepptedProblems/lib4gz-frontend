import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RegistrationFlowService } from '../services/registration-flow.service';

/** `/register/complete` needs a registration from the code dialog or from Google. */
export const registrationIdGuard: CanActivateFn = () => {
  return inject(RegistrationFlowService).registration() ? true : inject(Router).createUrlTree(['/register']);
};
