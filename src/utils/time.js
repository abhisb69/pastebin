export function getNow(req) {
  if (process.env.TEST_MODE === "1") {
    const testNow = req.headers["x-test-now-ms"];
    if (testNow) {
      return Number(testNow);
    }
  }
  return Date.now();
}
