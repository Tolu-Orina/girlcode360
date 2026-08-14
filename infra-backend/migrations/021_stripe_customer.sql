-- Stripe Customer id for Checkout + Customer Portal. Nullable; DSQL ADD COLUMN
-- cannot add NOT NULL / DEFAULT in the same statement.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
