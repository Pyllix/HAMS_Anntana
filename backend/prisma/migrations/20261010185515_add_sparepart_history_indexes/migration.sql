-- CreateIndex
-- Keep writes available while building indexes on the active spare-part history tables.
CREATE INDEX CONCURRENTLY "sparepart_adds_live_created_at_id_idx" ON "sparepart_adds"("createdAt" DESC, "sparepart_add_id" DESC) WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX CONCURRENTLY "sparepart_adds_sparepart_id_live_created_at_id_idx" ON "sparepart_adds"("sparepart_id", "createdAt" DESC, "sparepart_add_id" DESC) WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX CONCURRENTLY "sparepart_txns_created_at_id_idx" ON "sparepart_txns"("createdAt" DESC, "txn_id" DESC);

-- CreateIndex
CREATE INDEX CONCURRENTLY "sparepart_txns_sparepart_id_created_at_id_idx" ON "sparepart_txns"("sparepart_id", "createdAt" DESC, "txn_id" DESC);
