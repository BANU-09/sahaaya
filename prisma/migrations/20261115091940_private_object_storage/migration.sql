-- CreateTable
CREATE TABLE "StoredObject" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);
