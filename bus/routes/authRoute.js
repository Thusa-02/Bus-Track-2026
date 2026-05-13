import express from "express";
import { register, login, me } from "../controller/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const route = express.Router();

route.post("/register", register);
route.post("/login", login);
route.get("/me", authMiddleware, me);

export default route;
