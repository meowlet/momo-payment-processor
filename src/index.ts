import { Elysia, t } from "elysia";
import { MongoClient, ObjectId } from "mongodb";
import { PaymentStatus, PremiumDuration, Transaction } from "./Entity";
import { randomBytes } from "crypto";
import EmailService from "./EmailService";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "test";
const TRANSACTION_COLLECTION = "transactions";
const GUEST_TOKEN_COLLECTION = "guest_tokens";
const USER_COLLECTION = "users";

const app = new Elysia()
  .onError(({ error }) => {
    console.log(error);
  })
  .post(
    "/momo-payment-process",
    async ({ body, set }) => {
      set.status = 204;

      const client = new MongoClient(MONGODB_URI);

      try {
        await client.connect();
        const db = client.db(DB_NAME);

        const transactionInfo = await db
          .collection(TRANSACTION_COLLECTION)
          .findOne<Transaction>({ orderId: body.orderId });

        if (!transactionInfo) {
          return;
        }

        if (body.requestId !== transactionInfo.requestId) {
          return;
        }

        if (body.resultCode !== 0) {
          await updateTransactionStatus(
            db,
            transactionInfo.orderId,
            PaymentStatus.FAILED
          );
          return;
        }

        await updateTransactionStatus(
          db,
          transactionInfo.orderId,
          PaymentStatus.SUCCESS
        );

        if (transactionInfo.type === "guest_premium_subscription") {
          const token = randomBytes(32).toString("hex");

          let expiryDate: Date;
          switch (transactionInfo.premiumDuration) {
            case PremiumDuration.ONE_MONTH:
              expiryDate = new Date(
                new Date().getTime() + 30 * 24 * 60 * 60 * 1000
              );
              break;
            case PremiumDuration.THREE_MONTH:
              expiryDate = new Date(
                new Date().getTime() + 90 * 24 * 60 * 60 * 1000
              );
              break;
            case PremiumDuration.SIX_MONTH:
              expiryDate = new Date(
                new Date().getTime() + 180 * 24 * 60 * 60 * 1000
              );
              break;
            case PremiumDuration.ONE_YEAR:
              expiryDate = new Date(
                new Date().getTime() + 365 * 24 * 60 * 60 * 1000
              );
              break;
            default:
              throw new Error("Thời hạn premium không hợp lệ");
          }

          await db.collection(GUEST_TOKEN_COLLECTION).insertOne({
            token,
            expiryDate,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const emailService = new EmailService();

          emailService.sendMail({
            from: "Himmel <noreply@meowsica.me>",
            to: transactionInfo.email!,
            subject: "Your Premium Access Token",
            text: `Thank you for purchasing premium access! Your access token is: ${token}. You can use this token to access premium content until ${expiryDate.toLocaleString()}.`,
            html: `<p>Thank you for purchasing premium access!</p><p>Your access token is: <strong>${token}</strong></p><p>You can use this token to access premium content until ${expiryDate.toLocaleString()}.</p><p>To use your token, visit: <a href="${
              process.env.FE_URL
            }/premium/access?token=${token}">${
              process.env.FE_URL
            }/premium/access?token=${token}</a></p>`,
          });

          return;
        }

        await updateUserPremiumStatus(
          db,
          transactionInfo.user.toString(),
          true,
          transactionInfo.premiumDuration as PremiumDuration
        );
      } finally {
        await client.close();
      }
    },
    {
      body: t.Object({
        partnerCode: t.String(),
        orderId: t.String(),
        requestId: t.String(),
        amount: t.Number(),
        orderInfo: t.String(),
        orderType: t.String(),
        transId: t.Number(),
        resultCode: t.Number(),
        message: t.String(),
        payType: t.String(),
        responseTime: t.Number(),
        extraData: t.String(),
        signature: t.String(),
      }),
    }
  )
  .listen(4002);

console.log(
  `The app should be running at http://${app.server?.hostname}:${app.server?.port}`
);

async function updateTransactionStatus(
  db: any,
  orderId: string,
  status: PaymentStatus
) {
  await db
    .collection(TRANSACTION_COLLECTION)
    .updateOne(
      { orderId: orderId },
      { $set: { status, updatedAt: new Date() } }
    );
}

async function updateUserPremiumStatus(
  db: any,
  userId: string,
  status: boolean,
  duration: PremiumDuration
) {
  let expiryDate: Date;
  switch (duration) {
    case PremiumDuration.ONE_MONTH:
      expiryDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case PremiumDuration.THREE_MONTH:
      expiryDate = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case PremiumDuration.SIX_MONTH:
      expiryDate = new Date(new Date().getTime() + 180 * 24 * 60 * 60 * 1000);
      break;
    case PremiumDuration.ONE_YEAR:
      expiryDate = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error("Thời hạn premium không hợp lệ");
  }

  await db.collection(USER_COLLECTION).updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        isPremium: status,
        premiumExpiryDate: expiryDate,
        updatedAt: new Date(),
      },
    }
  );
}
