// Import components for internal use
import NotFoundComponent from '../NotFound';
import BadRequestComponent from './BadRequest';
import UnauthorizedComponent from './Unauthorized';
import ForbiddenComponent from './Forbidden';
import InternalServerErrorComponent from './InternalServerError';
import GenericErrorComponent from './GenericError';

// Error page exports
export { default as NotFound } from '../NotFound';
export { default as BadRequest } from './BadRequest';
export { default as Unauthorized } from './Unauthorized';
export { default as Forbidden } from './Forbidden';
export { default as InternalServerError } from './InternalServerError';
export { default as GenericError } from './GenericError';

// Error page types
export interface ErrorPageProps {
  message?: string;
  details?: string;
  errorId?: string;
}

// HTTP Status Code to Component mapping
export const ERROR_PAGES = {
  400: BadRequestComponent,
  401: UnauthorizedComponent,
  403: ForbiddenComponent,
  404: NotFoundComponent,
  500: InternalServerErrorComponent,
} as const;

export type ErrorStatusCode = keyof typeof ERROR_PAGES;

// Helper function to get error page component
export const getErrorPageComponent = (statusCode: number) => {
  return ERROR_PAGES[statusCode as ErrorStatusCode] || GenericErrorComponent;
};