import { Request, Response } from "express";
import prisma from "../config/prisma.ts";
import { gearSchema } from "../validations/auth.validation.ts";
import { AppError } from "../utils/AppError";

// 1. Get All Gears (with optional filters)
export const getGears = async (req: Request, res: Response) => {
  const { category, brand, minPrice, maxPrice, searchTerm } = req.query;

  const where: any = {};

  if (category) {
    where.category = {
      name: {
        contains: String(category),
        mode: "insensitive",
      },
    };
  }

  if (brand) {
    where.brand = {
      contains: String(brand),
      mode: "insensitive",
    };
  }

  if (minPrice || maxPrice) {
    where.pricePerDay = {};
    if (minPrice) where.pricePerDay.gte = Number(minPrice);
    if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
  }

  if (searchTerm) {
    where.OR = [
      { title: { contains: String(searchTerm), mode: "insensitive" } },
      { description: { contains: String(searchTerm), mode: "insensitive" } },
      { brand: { contains: String(searchTerm), mode: "insensitive" } },
    ];
  }

  const gears = await prisma.gearItem.findMany({
    where,
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({
    success: true,
    message: "All Gear items fetched successfully!",
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
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!gear) {
    throw new AppError(404, "Gear item not found");
  }

  return res.json({
    success: true,
    message: "Gear item details fetched successfully!",
    data: gear,
  });
};

// 3. Create Gear
export const createGear = async (req: Request, res: Response) => {
  const validatedData = gearSchema.parse(req.body || {});
  const user = (req as any).user;

  if (!user?.id) {
    throw new AppError(401, "Unauthorized! User ID not found.");
  }

  const { categoryId, images, ...rest } = validatedData as any;

  const gear = await prisma.gearItem.create({
    data: {
      ...rest,
      images: images || [],
      provider: {
        connect: { id: user.id },
      },
      ...(categoryId && {
        category: {
          connect: { id: categoryId },
        },
      }),
    },
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message: "Gear item created successfully!",
    data: gear,
  });
};

// 4. Update Gear
export const updateGear = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user?.id) {
    throw new AppError(401, "Unauthorized");
  }

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
    throw new AppError(403, "Unauthorized to update this item");
  }

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
    include: {
      category: true,
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    message: "Gear item updated successfully!",
    data: updated,
  });
};

// 5. Delete Gear (Safe Delete Handling)
export const deleteGear = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!user?.id) {
    throw new AppError(401, "Unauthorized");
  }

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
    throw new AppError(403, "Unauthorized to delete this item");
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
        message: "Gear item removed from available listings successfully",
      });
    }

    throw error;
  }
};