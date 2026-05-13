import express from "express";
import {
  addBusScheduleTrip,
  createBus,
  deleteBus,
  deleteBusScheduleTrip,
  getBuses,
  getBusSchedule,
  getNextDeparture,
  updateBus,
  updateBusScheduleTrip,
} from "../controller/busController.js";
import { authMiddleware, adminOnly } from "../middleware/authMiddleware.js";

const route = express.Router();

route.post("/create", authMiddleware, adminOnly, createBus);
route.get("/getall", getBuses);
route.put("/update/:id", authMiddleware, adminOnly, updateBus);
route.delete("/delete/:id", authMiddleware, adminOnly, deleteBus);
route.get("/:id/schedule", getBusSchedule);
route.get("/:id/next-departure", getNextDeparture);
route.post("/:id/schedule", authMiddleware, adminOnly, addBusScheduleTrip);
route.put("/:id/schedule/:tripId", authMiddleware, adminOnly, updateBusScheduleTrip);
route.delete("/:id/schedule/:tripId", authMiddleware, adminOnly, deleteBusScheduleTrip);

export default route;