import { Request, Response } from "express";
import prisma from "../config/prisma.ts";
import { gearSchema } from "../validations/auth.validation.ts";
import { AppError } from "../utils/AppError";

// ইমেজ ক্লিন ও ভ্যালিডেট করার হেল্পার ফাংশন (কোনো ডিফল্ট ইমেজ বসাবে না)
const sanitizeImages = (imagesInput: any): string[] => {
  if (!Array.isArray(imagesInput)) {
    return [];
  }

  return imagesInput
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => {
      if (!url) return false;
      // আনস্প্ল্যাশ ওয়েবপেজ লিঙ্ক বাতিল করা (সরাসরি ইমেজ লিঙ্ক নয়)
      if (url.includes("unsplash.com/photos/")) return false;
      return true;
    });
};

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

  // পোস্টম্যান থেকে পাঠানো ইমেজ ক্লিন করা (ডিফল্ট কিছু যোগ হবে না)
  const finalImages = sanitizeImages(images);

  const gear = await prisma.gearItem.create({
    data: {
      ...rest,
      images: finalImages,
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

  const { categoryId, category, images, ...restData } = req.body;

  const updatePayload: any = { ...restData };

  // পোস্টম্যান থেকে পাঠানো নতুন ইমেজ সরাসরি সেট হবে
  if (images !== undefined) {
    updatePayload.images = sanitizeImages(images);
  }

  if (categoryId) {
    updatePayload.category = {
      connect: { id: categoryId },
    };
  }

  const updated = await prisma.gearItem.update({
    where: {
      id: String(id),
    },
    data: updatePayload,
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