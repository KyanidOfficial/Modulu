const isAggressorLocked = report => Boolean(report?.state?.flags?.aggressorLocked)

module.exports = {
  isAggressorLocked
}
