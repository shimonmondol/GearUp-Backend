import { Request, Response } from "express";
import prisma from "../config/prisma.ts";
import { gearSchema } from "../validations/auth.validation.ts";
import { AppError } from "../utils/AppError";

// ডিফল্ট ইমেজ প্লেসহোল্ডার
const DEFAULT_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80";

// ইমেজ ক্লিন ও ভ্যালিডেট করার হেল্পার ফাংশন
const sanitizeImages = (imagesInput: any): string[] => {
  if (!Array.isArray(imagesInput) || imagesInput.length === 0) {
    return [DEFAULT_PLACEHOLDER_IMAGE];
  }

  const validImages = imagesInput
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => {
      if (!url) return false;
      // আনস্প্ল্যাশ ওয়েবপেজ লিঙ্ক বাতিল করা (সরাসরি ইমেজ লিঙ্ক নয়)
      if (url.includes("unsplash.com/photos/")) return false;
      return true;
    });

  return validImages.length > 0 ? validImages : [DEFAULT_PLACEHOLDER_IMAGE];
};

// ডাটাবেজের খালি ডেটাকে রেসপন্সে পাঠানোর আগে ফিক্স করার হেল্পার
const formatGearResponse = (gear: any) => {
  if (!gear) return gear;
  return {
    ...gear,
    images: sanitizeImages(gear.images),
  };
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

  // ডাটাবেজের পুরোনো খালি images অ্যারে থাকলে তা ডিফল্ট ইমেজ দিয়ে রিপ্লেস হবে
  const formattedGears = gears.map(formatGearResponse);

  return res.json({
    success: true,
    message: "All Gear items fetched successfully!",
    data: formattedGears,
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
    data: formatGearResponse(gear),
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

  // ইমেজ সেনিটাইজ ও ডিফল্ট হ্যান্ডলিং
  const finalImages = sanitizeImages(images);

  const gear = await prisma.gearItem.create({
    data: {
      ...rest,
      images: finalImages, // নিশ্চিত নন-এম্পটি এবং ভ্যালিড ইমেজ
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
    data: formatGearResponse(gear),
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

  // আপডেট করার ডেটা প্রস্তুত করা
  const updatePayload: any = { ...restData };

  // যদি বডিতে images ফিল্ড পাঠানো হয় তবেই তা সেনিটাইজ করে আপডেট হবে
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
    data: formatGearResponse(updated),
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
