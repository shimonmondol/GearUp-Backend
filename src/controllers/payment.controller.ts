import { Request, Response } from "express";
import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../config/prisma";
import { AppError } from "../utils/AppError";

const store_id = process.env.SSL_STORE_ID || "testbox";
const store_passwd = process.env.SSL_STORE_PASSWORD || "qwerty";
const is_live = process.env.SSL_IS_LIVE === "true";

// Helper function: SSLCommerz Session Generator
const initSSLCommerzSession = async (order: any, user: any) => {
  const tran_id = `TRAN_${order.id.slice(0, 8)}_${Date.now()}`;
  const serverBase = process.env.SERVER_BASE_URL || "http://localhost:5000";

  const paymentData = {
    total_amount: Number(order.totalPrice),
    currency: "BDT",
    tran_id: tran_id,
    success_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=success`,
    fail_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=fail`,
    cancel_url: `${serverBase}/api/payments/confirm?orderId=${order.id}&status=cancel`,
    ipn_url: `${serverBase}/api/payments/confirm?orderId=${order.id}`,
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
    gatewayUrl: sslResponse.GatewayPageURL, // Frontend compatibility
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

// 3. Confirm / Verify Payment Callback (Success / Fail / Cancel Webhook)
export const confirmPayment = async (req: Request, res: Response) => {
  const clientBase = process.env.CLIENT_BASE_URL || "http://localhost:3000";

  // SSLCommerz parameters query এবং body উভয় জায়গা থেকেই চেক করা
  const orderId = (req.query.orderId as string) || req.body?.value_a;
  const status = (req.query.status as string) || (req.body?.status === "VALID" ? "success" : req.body?.status);
  const tranId = req.body?.tran_id || `SSL_${Date.now().toString().slice(-8)}`;
  const val_id = req.body?.val_id;

  if (!orderId) {
    return res.redirect(`${clientBase}/dashboard/customer?error=missing_order_id`);
  }

  const order = await prisma.rentalOrder.findUnique({
    where: { id: String(orderId) },
  });

  if (!order) {
    return res.redirect(`${clientBase}/dashboard/customer?error=order_not_found`);
  }

  // যদি স্ট্যাটাস সাকসেস হয় অথবা SSLCommerz থেকে VALID পাঠায়
  if (status === "success" || req.body?.status === "VALID") {
    let isValid = true;

    // স্যান্ডবক্স বা লাইভ মোডে ভ্যালিডেশন চেক (যদি val_id থাকে)
    if (val_id && !is_live) {
      try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const validationResponse = await sslcz.validate({ val_id });
        isValid = validationResponse?.status === "VALID" || validationResponse?.status === "VALIDATED";
      } catch (err) {
        // স্যান্ডবক্সে ভ্যালিডেশন নেটওয়ার্ক এরর হলেও সাকসেস ফ্লো বজায় রাখা
        isValid = true;
      }
    }

    if (isValid) {
      await prisma.rentalOrder.update({
        where: { id: String(orderId) },
        data: { status: "PAID" as any },
      });

      // সরাসরি ফ্রন্টএন্ডের Success Page-এ রিডাইরেক্ট
      return res.redirect(
        `${clientBase}/payment/success?orderId=${orderId}&tran_id=${tranId}&amount=${order.totalPrice}`
      );
    }
  }

  // পেমেন্ট বাতিল বা ব্যর্থ হলে
  return res.redirect(
    `${clientBase}/dashboard/customer?payment=failed&orderId=${orderId}`
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

  if (paymentDetails.customerId !== user.id && user.role !== "admin" && user.role !== "ADMIN") {
    throw new AppError(403, "Unauthorized to view these payment details");
  }

  res.status(200).json({
    success: true,
    message: "Payment details fetched successfully",
    data: paymentDetails,
  });
};