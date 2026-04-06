/** DB enum `CourierWorkflowStatus` — runtime string literals */
export const COURIER_STATUS = {
  PENDING: 'PENDING',
  PRE_APPROVED: 'PRE_APPROVED',
  DOCUMENT_PENDING: 'DOCUMENT_PENDING',
  DOCUMENT_REVIEW: 'DOCUMENT_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type CourierWorkflowStatusLiteral =
  (typeof COURIER_STATUS)[keyof typeof COURIER_STATUS];
