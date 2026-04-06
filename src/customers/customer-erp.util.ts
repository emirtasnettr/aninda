import { ErpCustomerType, Role } from '@prisma/client';

export function erpCustomerTypeFromRole(role: Role): ErpCustomerType {
  if (role === Role.CORPORATE_CUSTOMER) {
    return ErpCustomerType.CORPORATE;
  }
  return ErpCustomerType.INDIVIDUAL;
}

export function isCustomerRole(role: Role): boolean {
  return role === Role.INDIVIDUAL_CUSTOMER || role === Role.CORPORATE_CUSTOMER;
}
