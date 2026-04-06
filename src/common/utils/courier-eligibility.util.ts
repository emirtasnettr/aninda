import { COURIER_STATUS } from '../constants/courier-workflow';

/** Aktif kurye: sipariş / çevrimiçi / teklif */
export function courierMayOperateDeliveries(c: {
  workflowStatus: string;
}): boolean {
  return c.workflowStatus === COURIER_STATUS.APPROVED;
}
