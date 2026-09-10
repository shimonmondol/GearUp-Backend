import { Router } from "express";
import {
  createGear,
  deleteGear,
  getGears,
  getMyGears,
  updateGear,
  getGearById,
} from "../controllers/gear.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import prisma from "../config/prisma";

const router = Router();

// ==========================================
// Category Routes
// ==========================================
router.post("/categories", protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const slug = name.toLowerCase().trim().replace(/ +/g, "-");
    const db: any = prisma;
    const categoryModel = db.category || db.Category;

    const newCategory = await categoryModel.create({
      data: { name, slug },
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const db: any = prisma;
    const categoryModel = db.category || db.Category;
    const categories = await categoryModel.findMany();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Gear Routes
// ==========================================

// 1. পাবলিক সব গিয়ার
router.get("/", getGears);

// ⚠️ 2. প্রোভাইডারের নিজস্ব গিয়ার (অবশ্যই /:id এর উপরে থাকতে হবে)
router.get("/my-gear", protect, restrictTo("provider"), getMyGears);

// 3. ডাইনামিক আইডি রুট (অবশ্যই /my-gear এর নিচে থাকবে)
router.get("/:id", getGearById);

// 4. গিয়ার তৈরি, আপডেট এবং ডিলিট
router.post("/", protect, restrictTo("provider"), createGear);
router.patch("/:id", protect, restrictTo("provider"), updateGear);
router.put("/:id", protect, restrictTo("provider"), updateGear);
router.delete("/:id", protect, restrictTo("provider"), deleteGear);

export default router;
