import { Request, Response } from "express";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

// TypeScript Interface: ইনপুট ডেটার নিরাপদ টাইপ
interface CreateGearPayload {
  title: string;
  description: string;
  pricePerDay: number | string;
  category?: string;
  categoryId?: string;
  brand?: string;
  stockQuantity?: number | string;
  images?: string[];
  isAvailable?: boolean;
}

// ইমেজ ক্লিন ও ভ্যালিডেট করার হেল্পার ফাংশন
const sanitizeImages = (imagesInput: any): string[] => {
  if (!Array.isArray(imagesInput)) {
    return [];
  }

  return imagesInput
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => {
      if (!url) return false;
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

// 2. Get Logged-in Provider's Own Gears (GET /api/gear/my-gear)
export const getMyGears = async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user?.id) {
    throw new AppError(401, "Unauthorized! User ID not found.");
  }

  const gears = await prisma.gearItem.findMany({
    where: {
      providerId: user.id,
    },
    include: {
      category: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({
    success: true,
    message: "Provider gear items fetched successfully!",
    data: gears,
  });
};

// 3. Get Single Gear by ID
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

// 4. Create Gear (Zod বাদ দিয়ে পিওর TypeScript ভ্যালিডেশন)
export const createGear = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const providerId = user?.id || user?.userId || user?._id;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! User ID missing in token.",
      });
    }

    const body: CreateGearPayload = req.body || {};

    // ক) পিওর TypeScript ভ্যালিডেশন লজিক
    const errors: string[] = [];

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      errors.push("Gear title is required.");
    }

    if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
      errors.push("Gear description is required.");
    }

    const price = Number(body.pricePerDay);
    if (isNaN(price) || price <= 0) {
      errors.push("Price per day must be a valid positive number.");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    // খ) ক্যাটাগরি আইডি বের বা স্বয়ংক্রিয়ভাবে তৈরি করা
    let targetCategoryId = body.categoryId;

    if (!targetCategoryId) {
      const categoryName = (body.category || "General").trim();
      const slug = categoryName.toLowerCase().replace(/\s+/g, "-");

      let foundCat = await prisma.category.findFirst({
        where: {
          OR: [
            { name: { equals: categoryName, mode: "insensitive" } },
            { slug: { equals: slug, mode: "insensitive" } },
          ],
        },
      });

      if (!foundCat) {
        foundCat = await prisma.category.create({
          data: {
            name: categoryName,
            slug,
          },
        });
      }

      targetCategoryId = foundCat.id;
    }

    // গ) ইমেজ স্যানিটাইজেশন
    const finalImages = sanitizeImages(body.images);
    const imagesToStore =
      finalImages.length > 0
        ? finalImages
        : ["https://placehold.co/600x400?text=Gear+Image"];

    // ঘ) Prisma-তে গিয়ার তৈরি করা
    const gear = await prisma.gearItem.create({
      data: {
        title: body.title.trim(),
        description: body.description.trim(),
        brand: (body.brand || "General").trim(),
        pricePerDay: price,
        stockQuantity: Math.max(1, Number(body.stockQuantity) || 1),
        isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : true,
        images: imagesToStore,
        provider: {
          connect: { id: String(providerId) },
        },
        category: {
          connect: { id: String(targetCategoryId) },
        },
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
  } catch (error: any) {
    console.error("❌ Error in createGear:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create gear listing",
    });
  }
};

// 5. Update Gear
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

// 6. Delete Gear (Safe Delete Handling)
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