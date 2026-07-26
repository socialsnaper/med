import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import {
  listRoomsController,
  getRoomController,
  createRoomController,
  updateRoomController,
  deleteRoomController,
} from '../controllers/rooms.controller';

export const roomsRouter = Router();

const auth = [requireAccessToken];

roomsRouter.get('/',       ...auth, listRoomsController);    // GET    /api/rooms
roomsRouter.post('/',      ...auth, createRoomController);   // POST   /api/rooms
roomsRouter.get('/:id',    ...auth, getRoomController);      // GET    /api/rooms/:id
roomsRouter.patch('/:id',  ...auth, updateRoomController);   // PATCH  /api/rooms/:id
roomsRouter.delete('/:id', ...auth, deleteRoomController);   // DELETE /api/rooms/:id
