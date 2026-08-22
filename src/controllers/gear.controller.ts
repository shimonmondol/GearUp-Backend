import { Request, Response } from "express";
import prisma from "../config/prisma.ts";
import { gearSchema } from "../validations/auth.validation.ts";
import { AppError } from "../utils/AppError";

// 1. Get All Gears (with filters)
export const getGears = async (req: Request, res: Response) => {
  const { category, brand, minPrice, maxPrice } = req.query;

  const gears = await prisma.gearItem.findMany({
    where: {
      isAvailable: true,
      brand: brand ? String(brand) : undefined,
      ...(category && { category: { name: String(category) } }),
      ...((minPrice || maxPrice) && {
        pricePerDay: {
          gte: minPrice ? Number(minPrice) : undefined,
          lte: maxPrice ? Number(maxPrice) : undefined,
        },
      }),
    },
    include: { category: true },
  });

  res.json({
    success: true,
    message: "All Gear items Show successfully!",
    data: gears,
  });
};

// 2. Get Single Gear by ID
export const getGearById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const gear = await prisma.gearItem.findUnique({
    where: {
      id: String(id),
    },
    include: {
      category: true,
    },
  });

  if (!gear) {
    throw new AppError(404, "Gear item not found");
  }

  res.json({
    success: true,
    message: "Gear item details successfully!",
    data: gear,
  });
};

// 3. Create Gear
export const createGear = async (req: Request, res: Response) => {
  const validatedData = gearSchema.parse(req.body || {});
  const user = (req as any).user;

  const { categoryId, ...rest } = validatedData as any;

  const gear = await prisma.gearItem.create({
    data: {
      ...rest,
      providerId: user.id,
      ...(categoryId && {
        category: {
          connect: { id: categoryId },
        },
      }),
    },
    include: { category: true },
  });

  res.status(201).json({
    success: true,
    message: "Gear item created successfully!",
    data: gear,
  });
};

// 4. Update Gear (Fixed categoryId Prisma Relation)
export const updateGear = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const gear = await prisma.gearItem.findUnique({
    where: {
      id: String(id),
    },
  });
  if (!gear) throw new AppError(404, "Gear item not found");

  if (
    gear.providerId !== user.id &&
    user.role !== "admin" &&
    user.role !== "ADMIN"
  ) {
    throw new AppError(403, "Unauthorized");
  }

  // categoryId আলাদা করে প্রিজমা রিলেশন সেট করা
  const { categoryId, category, ...restData } = req.body;

  const updated = await prisma.gearItem.update({
    where: {
      id: String(id),
    },
    data: {
      ...restData,
      ...(categoryId && {
        category: {
          connect: { id: categoryId },
        },
      }),
    },
    include: { category: true },
  });

  res.json({
    success: true,
    message: "Gear item updated successfully!",
    data: updated,
  });
};

// 5. Delete Gear (Safe Delete Handling)
export const deleteGear = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const gear = await prisma.gearItem.findUnique({
    where: {
      id: String(id),
    },
  });
  if (!gear) throw new AppError(404, "Gear item not found");

  if (
    gear.providerId !== user.id &&
    user.role !== "admin" &&
    user.role !== "ADMIN"
  ) {
    throw new AppError(403, "Unauthorized");
  }

  try {
    await prisma.gearItem.delete({
      where: {
        id: String(id),
      },
    });

    return res.json({
      success: true,
      message: "Gear item deleted successfully!",
    });
  } catch (error: any) {
    if (
      error.code === "P2003" ||
      error.message?.includes("foreign key constraint")
    ) {
      await prisma.gearItem.update({
        where: { id: String(id) },
        data: {
          isAvailable: false,
          stockQuantity: 0,
        },
      });

      return res.json({
        success: true,
        message:
          "Gear item removed from available listings successfully",
      });
    }

    throw error;
  }
};