import assert from "node:assert/strict";
import { test } from "node:test";
import { youcamClientFailCopy, youcamErrorCode } from "./youcam-errors.ts";

test("youcamErrorCode reads nested task error", () => {
  assert.equal(
    youcamErrorCode({ error: "error_face_angle_invalid", task_status: "error" }),
    "error_face_angle_invalid",
  );
});

test("youcamClientFailCopy guides a retry for face angle", () => {
  const copy = youcamClientFailCopy("error_face_angle_invalid");
  assert.match(copy, /straight/);
  assert.match(copy, /try again/i);
});
