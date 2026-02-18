const test = require("node:test")
const assert = require("node:assert/strict")

const mysql = require("../mysql")
const { makePoolFixture } = require("./fixtures/mysqlFixture")

test("mysql fixture executes query through shared pool", async () => {
  mysql.__resetPoolForTests()
  mysql.__setPoolForTests(makePoolFixture())

  const [rows] = await mysql.executeQuery("SELECT 1", [])
  assert.equal(Array.isArray(rows), true)
  assert.equal(rows.length, 1)
})

test("slow connection simulation resolves without overlap crashes", async () => {
  mysql.__resetPoolForTests()
  mysql.__setPoolForTests(makePoolFixture({ delayMs: 50 }))

  const started = Date.now()
  await mysql.executeQuery("SELECT SLOW_TEST", [])
  const elapsed = Date.now() - started

  assert.equal(elapsed >= 50, true)
})

test("timeout behavior returns safe default and flags timeout errors", async () => {
  mysql.__resetPoolForTests()
  mysql.__setPoolForTests(makePoolFixture({ shouldTimeout: true }))

  const [rows, meta] = await mysql.executeQuery("SELECT FAIL", [])

  assert.deepEqual(rows, [])
  assert.equal(meta.affectedRows, 0)
  assert.equal(mysql.isTimeoutError({ code: "ETIMEDOUT" }), true)
})
