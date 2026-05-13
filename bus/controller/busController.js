import Bus from "../model/busModel.js";
import Update from "../model/updateModel.js";
import mongoose from "mongoose";
import { DIRECTIONS, STOPS } from "../constants/routeConstants.js";

//  Ensure time format is always HH:MM (data consistency)
const TIME_REGEX = /^\d{2}:\d{2}$/;

// Server may run in UTC → adjust to Sri Lanka time (UTC+5:30)
const SRI_LANKA_OFFSET_MINUTES = 5 * 60 + 30;

//-----------------UTILITY FUNCTIONS ( reusable logic, avoid repetition)----------------------------
//Convert "HH:MM" - total minutes (easy comparison)
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

//Get current time in Sri Lanka (accurate next departure calculation)
const getNowInSriLanka = () => {
  const utcMs = Date.now();
  const sriLankaMs = utcMs + SRI_LANKA_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(sriLankaMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

//Keep schedule sorted - easier reading & correct order
const sortTrips = (trips) =>
  [...trips].sort((a, b) => {
    if (a.direction !== b.direction) {
      return a.direction.localeCompare(b.direction);
    }
    const aStart = a.stopTimes?.[0]?.time ?? "23:59";
    const bStart = b.stopTimes?.[0]?.time ?? "23:59";
    return aStart.localeCompare(bStart);
  });

  //Remove unwanted fields - clean, consistent DB structure
const normalizeTrip = (trip) => ({
  direction: trip.direction,
  stopTimes: trip.stopTimes.map((entry) => ({
    stop: entry.stop,
    time: entry.time,
  })),
});

//---------------------VALIDATION LOGIC (prevent wrong schedule data)------------------------
const validateStopTimes = (direction, stopTimes) => {
  //Ensure only predefined directions allowed
  if (!DIRECTIONS.includes(direction)) {
    return "Invalid direction.";
  }

  //Ensure all stops are included (no missing data)
  if (!Array.isArray(stopTimes) || stopTimes.length !== STOPS.length) {
    return `stopTimes must include exactly ${STOPS.length} stops.`;
  }
  //Enforce correct stop order (route consistency)
  const expectedStops = direction === "TO_VAVUNIYA" ? [...STOPS].reverse() : STOPS;

  for (let i = 0; i < stopTimes.length; i += 1) {
    const entry = stopTimes[i];
    if (!entry || entry.stop !== expectedStops[i]) {
      return `Stop order is invalid for ${direction}.`;
    }
  //Prevent invalid time format
    if (!TIME_REGEX.test(entry.time)) {
      return `Time ${entry.time} must be in HH:MM format.`;
    }
  }

  return null;
};

// -------------------------CREATE BUS (add new bus safely)-------------------------------------
export const createBus = async (req, res) => {
  try {
    const { busNumber, routeName } = req.body;
  //Prevent empty inputs
    if (!busNumber || !routeName) {
      return res.status(400).json({ message: "Bus number and route name are required." });
    }
  // Avoid duplicate buses
    const exists = await Bus.findOne({ busNumber: busNumber.trim() });
    if (exists) {
      return res.status(400).json({ message: "Bus already exists." });
    }
  //Clean input before saving
    const bus = new Bus({
      busNumber: busNumber.trim(),
      routeName: routeName.trim(),
    });

    const saved = await bus.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//------------------------- READ BUSES (fetch all buses sorted)-------------------------------------
export const getBuses = async (req, res) => {
  try {
    //Sorted output - better UI display
    const buses = await Bus.find().sort({ busNumber: 1 });
    res.status(200).json(buses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ---------------------UPDATE BUS (controlled updates only)-------------------------------------------
export const updateBus = async (req, res) => {
  try {
    const { id } = req.params;
    //Prevent invalid MongoDB IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

    const { busNumber, routeName, status } = req.body;
    //Prevent mass assignment (security)
    const allowedUpdates = {};
    if (busNumber !== undefined) allowedUpdates.busNumber = busNumber.trim();
    if (routeName !== undefined) allowedUpdates.routeName = routeName.trim();
    if (status !== undefined) allowedUpdates.status = status;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update." });
    }

    const updated = await Bus.findByIdAndUpdate(id, allowedUpdates, {
      new: true,
      runValidators: true,//enforce schema rules
    });

    if (!updated) {
      return res.status(404).json({ message: "Bus not found." });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//---------------------- DELETE BUS (safe deletion using transaction)-------------------------------
export const deleteBus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
     //Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

     //Ensure bus exists before deleting
    const exists = await Bus.findById(id).session(session);
    if (!exists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Bus not found." });
    }

    //Maintain data integrity (delete related updates too)
    await Update.deleteMany({ busId: id }).session(session);
    await Bus.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Bus and related updates deleted successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//-----------------------------SCHEDULE MANAGEMENT (handle trips)---------------------------
export const getBusSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }
    //Fetch bus with only required fields
    const bus = await Bus.findById(id).select("busNumber routeName schedule");
    
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    //Send sorted schedule response(Ensure consistent order for frontend display)
    res.status(200).json({
      busId: bus._id,
      busNumber: bus.busNumber,
      routeName: bus.routeName,
      schedule: sortTrips(bus.schedule),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//----------------------------ADD NEW SCHEDULE TRIP-------------------------------
export const addBusScheduleTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { direction, stopTimes } = req.body;

    console.log("Request Body:", { direction, stopTimes });
    console.log("Bus ID:", id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

    const validationError = validateStopTimes(direction, stopTimes);
    if (validationError) {
      console.log("Validation Error:", validationError);
      return res.status(400).json({ message: validationError });
    }

    const bus = await Bus.findById(id);
    if (!bus) {
      console.log("Bus not found with ID:", id);
      return res.status(404).json({ message: "Bus not found." });
    }

    const newTrip = normalizeTrip({ direction, stopTimes });
    console.log("Normalized Trip to Save:", newTrip);

    bus.schedule.push(newTrip);

    const savedBus = await bus.save();
    console.log("SUCCESS: Bus saved! Total schedules now:", savedBus.schedule.length);

    res.status(201).json({
      message: "Schedule trip added successfully.",
      schedule: sortTrips(savedBus.schedule),
    });
  } catch (error) {
    console.error("CRITICAL ERROR in addBusScheduleTrip:", error);
    res.status(500).json({ 
      message: "Failed to save schedule trip",
      error: error.message 
    });
  }
};
export const updateBusScheduleTrip = async (req, res) => {
  try {
    const { id, tripId } = req.params;
    const { direction, stopTimes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ message: "Invalid trip ID format." });
    }

    const validationError = validateStopTimes(direction, stopTimes);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const trip = bus.schedule.id(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Schedule trip not found." });
    }

    trip.direction = direction;
    trip.stopTimes = normalizeTrip({ direction, stopTimes }).stopTimes;
    await bus.save();

    res.status(200).json({
      message: "Schedule trip updated successfully.",
      schedule: sortTrips(bus.schedule),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteBusScheduleTrip = async (req, res) => {
  try {
    const { id, tripId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ message: "Invalid trip ID format." });
    }

    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const trip = bus.schedule.id(tripId);
    if (!trip) {
      return res.status(404).json({ message: "Schedule trip not found." });
    }

    trip.deleteOne();
    await bus.save();

    res.status(200).json({
      message: "Schedule trip deleted successfully.",
      schedule: sortTrips(bus.schedule),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getNextDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    const { direction, stop } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid bus ID format." });
    }

    if (!DIRECTIONS.includes(direction)) {
      return res.status(400).json({ message: "Invalid direction." });
    }

    if (!STOPS.includes(stop)) {
      return res.status(400).json({ message: "Invalid stop." });
    }

    const bus = await Bus.findById(id).select("busNumber routeName schedule");
    if (!bus) {
      return res.status(404).json({ message: "Bus not found." });
    }

    const nowMinutes = getNowInSriLanka();

    const todayCandidates = bus.schedule
      .filter((trip) => trip.direction === direction)
      .map((trip) => {
        const stopEntry = trip.stopTimes.find((entry) => entry.stop === stop);
        return stopEntry
          ? { tripId: trip._id, time: stopEntry.time, minutes: toMinutes(stopEntry.time) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.minutes - b.minutes);

    if (!todayCandidates.length) {
      return res.status(404).json({ message: "No schedule trips found for this stop/direction." });
    }

    const next = todayCandidates.find((candidate) => candidate.minutes >= nowMinutes) || todayCandidates[0];
    const wrapsToTomorrow = next.minutes < nowMinutes;

    res.status(200).json({
      busId: bus._id,
      busNumber: bus.busNumber,
      routeName: bus.routeName,
      direction,
      stop,
      nextDeparture: {
        tripId: next.tripId,
        time: next.time,
        wrapsToTomorrow,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};