import { Request, Response } from "express";
import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

const store_id = process.env.SSL_STORE_ID || "testbox";
const store_passwd = process.env.SSL_STORE_PASSWORD || "qwerty";
const is_live = process.env.SSL_IS_LIVE === "true";

// Helper function: SSLCommerz Session Generator
const initSSLCommerzSession = async (order: any, user: any) => {
  // tran_id এর ভেতর সরাসরি order.id রাখা হয়েছে যেন ফেইল্ড হলে tran_id থেকেও রিকভার করা যায়
  const tran_id = `GU_${order.id}_${Date.now()}`;

  const serverBase =
    process.env.SERVER_BASE_URL || "https://gear-up-beta.vercel.app";

  const paymentData = {
    total_amount: Number(order.totalPrice),
    currency: "BDT",
    tran_id: tran_id,
    success_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=success`,
    fail_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=failed`,
    cancel_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=failed`,
    ipn_url: `${serverBase}/api/payments/confirm?orderId=${order.id}`,

    // SSLCommerz ফেইল বা ক্যানসেল হলেও value_a ফেরত পাঠায়
    value_a: String(order.id),

    shipping_method: "NO",
    product_name: `Rental Order #${order.id.slice(0, 8)}`,
    product_category: "Gear Rental",
    product_profile: "general",
    cus_name: user?.name || "Customer Name",
    cus_email: user?.email || "customer@example.com",
    cus_add1: "Dhaka",
    cus_city: "Dhaka",
    cus_postcode: "1207",
    cus_country: "Bangladesh",
    cus_phone: user?.phone || "01700000000",
  };

  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  const sslResponse = await sslcz.init(paymentData);

  if (!sslResponse?.GatewayPageURL) {
    throw new AppError(500, "Failed to create SSLCommerz payment session");
  }

  return {
    paymentUrl: sslResponse.GatewayPageURL,
    gatewayUrl: sslResponse.GatewayPageURL,
    transactionId: tran_id,
  };
};

// 1. Create Payment Session via Request Body ({ orderId })
export const createPaymentSession = async (req: Request, res: Response) => {
  const { orderId } = req.body;
  const user = (req as any).user;

  if (!orderId) {
    throw new AppError(400, "Order ID is required");
  }

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(orderId) },
    include: { customer: true },
  });

  if (!order) {
    throw new AppError(404, "Rental order not found");
  }

  if (order.customerId !== user.id) {
    throw new AppError(403, "You are not authorized to pay for this order");
  }

  const session = await initSSLCommerzSession(order, user);

  res.status(200).json({
    success: true,
    message: "Payment session initialized successfully",
    ...session,
  });
};

// 2. Initiate Payment via URL Params (/initiate/:orderId)
export const initiatePaymentWithParam = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const user = (req as any).user;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(orderId) },
    include: { customer: true },
  });

  if (!order) {
    throw new AppError(404, "Rental order not found");
  }

  if (order.customerId !== user.id) {
    throw new AppError(403, "You are not authorized to pay for this order");
  }

  const session = await initSSLCommerzSession(order, user);

  res.status(200).json({
    success: true,
    message: "Payment session initialized successfully",
    ...session,
  });
};

// 3. Confirm / Verify Payment Callback (Success ও Failed নির্ভুল হ্যান্ডলিং)
export const confirmPayment = async (req: Request, res: Response) => {
  const clientBase =
    process.env.CLIENT_BASE_URL || "https://gear-up-frontend-rosy.vercel.app";

  const rawTranId =
    (req.body?.tran_id as string) || (req.query?.tran_id as string) || "";

  // tran_id (GU_<orderId>_<timestamp>) থেকে ফলব্যাক orderId উদ্ধার
  let extractedOrderIdFromTran = "";
  if (rawTranId.startsWith("GU_")) {
    const parts = rawTranId.split("_");
    if (parts.length >= 3) {
      extractedOrderIdFromTran = parts.slice(1, -1).join("_");
    }
  }

  // সম্ভাব্য সব সোর্স থেকে orderId বের করা
  const orderId =
    (req.query.orderId as string) ||
    req.body?.value_a ||
    req.body?.orderId ||
    extractedOrderIdFromTran ||
    "";

  const queryStatus = (req.query.status as string) || "";
  const bodyStatus = (req.body?.status as string) || "";

  console.log("➡️ [Payment Callback]", {
    orderId,
    queryStatus,
    bodyStatus,
    tran_id: rawTranId,
  });

  const tranId =
    (req.body?.val_id as string) ||
    rawTranId ||
    `SSL_${Date.now().toString().slice(-8)}`;

  if (!orderId) {
    console.error("❌ Order ID could not be identified from callback");
    return res.redirect(
      303,
      `${clientBase}/payment/failed?message=missing_order_id`
    );
  }

  // পেমেন্ট সাকসেস চেক
  const isSuccess =
    queryStatus.toLowerCase() === "success" ||
    bodyStatus === "VALID" ||
    bodyStatus === "VALIDATED" ||
    bodyStatus === "SUCCESS";

  if (isSuccess) {
    try {
      await prisma.rentalOrder.update({
        where: { id: String(orderId) },
        data: { status: "PAID" as any },
      });
      console.log("✅ Order updated to PAID in DB:", orderId);
    } catch (dbError) {
      console.error("⚠️ DB update error (PAID):", dbError);
    }

    return res.redirect(
      303,
      `${clientBase}/payment/success?orderId=${orderId}&tranId=${tranId}&status=success`
    );
  }

  // ❌ ফেইল বা ক্যানসেল হলে ডাটাবেজে CANCELLED স্ট্যাটাস সেট করা
  try {
    await prisma.rentalOrder.update({
      where: { id: String(orderId) },
      data: { status: "CANCELLED" as any },
    });
    console.log("⚠️ Order updated to CANCELLED in DB:", orderId);
  } catch (dbError) {
    console.error("❌ DB update error (CANCELLED):", dbError);
  }

  return res.redirect(
    303,
    `${clientBase}/payment/failed?orderId=${orderId}&status=failed`
  );
};

// 4. Get User's Payment History
export const getMyPaymentHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;

  const ordersWithPayments = await prisma.rentalOrder.findMany({
    where: { customerId: user.id },
    select: {
      id: true,
      totalPrice: true,
      status: true,
      createdAt: true,
      orderItems: {
        include: {
          gear: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    success: true,
    message: "Payment history fetched successfully",
    data: ordersWithPayments,
  });
};

// 5. Get Payment Details by Order ID
export const getPaymentDetails = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const paymentDetails = await prisma.rentalOrder.findUnique({
    where: { id: String(id) },
    include: {
      customer: {
        select: { id: true, name: true, email: true },
      },
      orderItems: {
        include: { gear: true },
      },
    },
  });

  if (!paymentDetails) {
    throw new AppError(404, "Payment details not found for this order");
  }

  if (
    paymentDetails.customerId !== user.id &&
    user.role !== "admin" &&
    user.role !== "ADMIN"
  ) {
    throw new AppError(403, "Unauthorized to view these payment details");
  }

  res.status(200).json({
    success: true,
    message: "Payment details fetched successfully",
    data: paymentDetails,
  });
};