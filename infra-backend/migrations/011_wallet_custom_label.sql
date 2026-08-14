-- HW-F-02 custom category label (FR-047)
ALTER TABLE wallet_docs ADD COLUMN IF NOT EXISTS custom_label TEXT;
