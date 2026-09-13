import { Router } from "express";
import {
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  getAllPlatformGears,
  adminDeleteGear,
} from "../controllers/admin.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { Role } from "@prisma/client";

const router = Router();

// গ্লোবালি অ্যাডমিন রুটের জন্য অথেন্টিকেশন ও রোল গার্ড
router.use(protect);
router.use(restrictTo(Role.admin, "ADMIN", "admin"));

// অ্যাডমিন এন্ডপয়েন্টস
router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.get("/gears", getAllPlatformGears);
router.delete("/gears/:id", adminDeleteGear);
router.patch("/users/:id", toggleUserStatus);

export default router;