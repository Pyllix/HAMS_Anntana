import assert from "node:assert/strict";
import test from "node:test";
import { useAssetDetailModalStore } from "../src/stores/useAssetDetailModalStore";
import { useEquipmentDetailModalStore } from "../src/stores/useEquipmentDetailModalStore";
import type { Asset } from "../src/types/TypeAsset";

function asset(id: string, imageUrl: string): Asset {
  return { id, imageUrl } as Asset;
}

for (const [name, store] of [
  ["equipment detail", useEquipmentDetailModalStore],
  ["asset detail", useAssetDetailModalStore],
] as const) {
  test(`${name} replaces a selected asset with the saved image revision`, () => {
    store.getState().openModal(asset("asset-1", "https://images.test/v1.jpg"));
    store.getState().updateSelectedAsset(asset("asset-1", "https://images.test/v2.jpg"));

    assert.equal(store.getState().selectedAsset?.imageUrl, "https://images.test/v2.jpg");
    assert.equal(store.getState().isOpen, true);

    store.getState().updateSelectedAsset(asset("asset-2", "https://images.test/other.jpg"));
    assert.equal(store.getState().selectedAsset?.id, "asset-1");
    store.getState().closeModal();
  });
}
