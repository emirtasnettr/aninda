import { Role } from '@prisma/client';
import { Socket } from 'socket.io';

export interface WsAuthData {
  userId: string;
  email: string;
  role: Role;
  courierId?: string;
}

export function wsAuth(client: Socket): WsAuthData {
  return client.data as WsAuthData;
}
